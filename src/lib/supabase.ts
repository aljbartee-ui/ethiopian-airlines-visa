import { createClient } from '@supabase/supabase-js';
import type { FormData } from '@/types';

// Get these from your Supabase project dashboard
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  const configured = !!(supabaseUrl && supabaseKey);
  if (!configured) {
    console.warn('Supabase is not configured. Missing environment variables:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
    });
  }
  return configured;
};

// Only create the Supabase client if credentials are provided.
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      },
    })
  : (null as unknown as ReturnType<typeof createClient>);

// ---------------------------------------------------------------------------
// Internal helper: retry with exponential back-off.
// Handles BOTH thrown exceptions AND Supabase { error } response values so
// transient 522/503 errors are recovered automatically.
// ---------------------------------------------------------------------------
async function withRetry<D>(
  fn: () => Promise<{ data: D; error: any }>,
  maxAttempts = 3,
  baseDelayMs = 1500
): Promise<{ data: D; error: any }> {
  let lastResult: { data: D; error: any } = { data: null as unknown as D, error: null };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      // If Supabase returned an error value (not a thrown exception), retry too
      if (result.error) {
        lastResult = result;
        if (attempt < maxAttempts) {
          const delay = baseDelayMs * 2 ** (attempt - 1);
          console.warn(`Supabase error on attempt ${attempt}, retrying in ${delay}ms…`, result.error);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
      return result;
    } catch (err) {
      lastResult = { data: null as unknown as D, error: err };
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * 2 ** (attempt - 1);
        console.warn(`Fetch exception on attempt ${attempt}, retrying in ${delay}ms…`, err);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  return lastResult;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all applications in a single bulk query with automatic retry.
 */
export async function getAllApplications(): Promise<FormData[]> {
  if (!isSupabaseConfigured()) {
    const stored = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
    return stored.sort(
      (a: FormData, b: FormData) =>
        new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
    );
  }

  const { data, error } = await withRetry(() =>
    supabase
      .from('visa_applications')
      .select(
        'id,submission_date,status,travel_type,group_contact_name,group_contact_number,transit_airport,destination_airport_code,custom_destination_airport,needs_land_transport,passengers'
      )
      .order('submission_date', { ascending: false })
      .limit(500) as unknown as Promise<{ data: any[]; error: any }>
  );

  if (error) {
    console.error('Error fetching applications:', error);
    const stored = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
    return stored.sort(
      (a: FormData, b: FormData) =>
        new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
    );
  }

  const applications: FormData[] = (data || []).map((r: any) => ({
    id: r.id,
    submissionDate: r.submission_date,
    status: r.status,
    travelType: r.travel_type,
    groupContactName: r.group_contact_name,
    groupContactNumber: r.group_contact_number,
    transitAirport: r.transit_airport,
    destinationAirportCode: r.destination_airport_code,
    customDestinationAirport: r.custom_destination_airport,
    needsLandTransport: r.needs_land_transport,
    passengers: r.passengers || [],
  }));

  console.log(`Successfully fetched ${applications.length} applications`);
  return applications;
}

// Fetch full application details including images (on demand)
export async function getApplicationDetails(id: string): Promise<FormData | null> {
  if (!isSupabaseConfigured()) {
    const stored = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
    return stored.find((s: FormData) => s.id === id) || null;
  }

  const { data, error } = await withRetry(() =>
    supabase
      .from('visa_applications')
      .select('*')
      .eq('id', id)
      .single() as unknown as Promise<{ data: any; error: any }>
  );

  if (error) {
    console.error('Error fetching application details:', error);
    return null;
  }

  if (!data) return null;

  let passengers = data.passengers || [];

  // Backward compatibility: reconstruct from old single-passenger format
  if (passengers.length === 0 && data.civil_id_file) {
    passengers = [{
      id: crypto.randomUUID(),
      fullName: 'Primary Applicant',
      nationality: '',
      passportNumber: '',
      contactNumber: '',
      civilIdFile: data.civil_id_file,
      civilIdFileName: data.civil_id_file_name,
      passportFile: data.passport_file,
      passportFileName: data.passport_file_name,
      photoFile: data.photo_file,
      photoFileName: data.photo_file_name,
    }];
  }

  if (passengers.length === 0) {
    passengers = [{
      id: crypto.randomUUID(),
      fullName: 'Applicant',
      nationality: '',
      passportNumber: '',
      contactNumber: '',
    }];
  }

  return {
    id: data.id,
    submissionDate: data.submission_date,
    status: data.status,
    travelType: data.travel_type,
    groupContactName: data.group_contact_name,
    groupContactNumber: data.group_contact_number,
    transitAirport: data.transit_airport,
    destinationAirportCode: data.destination_airport_code,
    customDestinationAirport: data.custom_destination_airport,
    needsLandTransport: data.needs_land_transport,
    passengers,
  };
}

export async function createApplication(
  application: Omit<FormData, 'id' | 'submissionDate'>
): Promise<FormData> {
  if (!isSupabaseConfigured()) {
    const existing = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
    const newSubmission: FormData = {
      ...application,
      id: crypto.randomUUID(),
      submissionDate: new Date().toISOString(),
    };
    localStorage.setItem('visaSubmissions', JSON.stringify([...existing, newSubmission]));
    return newSubmission;
  }

  const { data, error } = await supabase
    .from('visa_applications')
    .insert([{
      status: application.status,
      travel_type: application.travelType,
      group_contact_name: application.groupContactName,
      group_contact_number: application.groupContactNumber,
      transit_airport: application.transitAirport,
      destination_airport_code: application.destinationAirportCode,
      custom_destination_airport: application.customDestinationAirport,
      needs_land_transport: application.needsLandTransport,
      passengers: application.passengers,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating application:', error);
    throw error;
  }
  return data;
}

export async function updateApplicationStatus(id: string, status: FormData['status']) {
  if (!isSupabaseConfigured()) {
    const existing = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
    const updated = existing.map((s: FormData) =>
      s.id === id ? { ...s, status } : s
    );
    localStorage.setItem('visaSubmissions', JSON.stringify(updated));
    return;
  }

  const { error } = await supabase
    .from('visa_applications')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('Error updating status:', error);
    throw error;
  }
}

export async function deleteApplication(id: string) {
  if (!isSupabaseConfigured()) {
    const existing = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
    const updated = existing.filter((s: FormData) => s.id !== id);
    localStorage.setItem('visaSubmissions', JSON.stringify(updated));
    return;
  }

  const { error } = await supabase
    .from('visa_applications')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting application:', error);
    throw error;
  }
}
