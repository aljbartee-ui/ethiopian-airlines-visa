import { createClient } from '@supabase/supabase-js';
import type { FormData } from '@/types';

// Get these from your Supabase project dashboard
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabaseUrl && supabaseKey;
};

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper functions for visa applications
export async function getAllApplications() {
  if (!isSupabaseConfigured()) {
    // Fallback to localStorage
    const data = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
    return data.sort((a: FormData, b: FormData) => 
      new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
    );
  }

  const { data, error } = await supabase
    .from('visa_applications')
    .select('*')
    .order('submission_date', { ascending: false });

  if (error) {
    console.error('Error fetching applications:', error);
    return [];
  }

  // Map snake_case from Supabase to camelCase for the frontend
  // Also handle backward compatibility for old applications that don't have the passengers array
  return (data || []).map((app: any) => {
    let passengers = app.passengers || [];
    
    // Backward compatibility: if no passengers array but old fields exist, reconstruct from old format
    if (passengers.length === 0 && app.civil_id_file) {
      passengers = [{
        id: crypto.randomUUID(),
        fullName: 'Primary Applicant',
        nationality: '',
        passportNumber: '',
        contactNumber: '',
        civilIdFile: app.civil_id_file,
        civilIdFileName: app.civil_id_file_name,
        passportFile: app.passport_file,
        passportFileName: app.passport_file_name,
        photoFile: app.photo_file,
        photoFileName: app.photo_file_name,
      }];
    }
    
    // If still no passengers, create a default empty passenger entry
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
      id: app.id,
      submissionDate: app.submission_date,
      status: app.status,
      travelType: app.travel_type,
      groupContactName: app.group_contact_name,
      groupContactNumber: app.group_contact_number,
      transitAirport: app.transit_airport,
      destinationAirportCode: app.destination_airport_code,
      customDestinationAirport: app.custom_destination_airport,
      needsLandTransport: app.needs_land_transport,
      passengers,
    };
  });
}

export async function createApplication(application: Omit<FormData, 'id' | 'submissionDate'>) {
  if (!isSupabaseConfigured()) {
    // Fallback to localStorage
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
    // Fallback to localStorage
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
    // Fallback to localStorage
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
