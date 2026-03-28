import { createClient } from '@supabase/supabase-js';
import type { FormData } from '@/types';

// Get these from your Supabase project dashboard
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  const configured = supabaseUrl && supabaseKey;
  if (!configured) {
    console.warn('Supabase is not configured. Missing environment variables:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey
    });
  }
  return configured;
};

export const supabase = createClient(supabaseUrl, supabaseKey);

// Ultra-Light fetch using direct HTTP request to avoid client library overhead
export async function getAllApplicationsUltraLight() {
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured, using localStorage fallback');
    const data = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
    return data.sort((a: FormData, b: FormData) => 
      new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
    );
  }

  try {
    console.log('Fetching applications using Ultra-Light mode (ID and Date only)...');
    
    // Use direct HTTP fetch to bypass client library overhead
    const response = await Promise.race([
      fetch(
        `${supabaseUrl}/rest/v1/visa_applications?select=id,submission_date&order=submission_date.desc&limit=100`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Accept': 'application/json',
          },
        }
      ),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Ultra-Light fetch timeout')), 15000)
      ) as Promise<Response>
    ]);

    if (!response.ok) {
      console.error(`HTTP Error: ${response.status} ${response.statusText}`);
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`Successfully fetched ${data?.length || 0} applications in Ultra-Light mode`);

    // Map snake_case to camelCase
    return (data || []).map((app: any) => ({
      id: app.id,
      submissionDate: app.submission_date,
      status: 'pending' as const,
      travelType: 'single' as const,
      groupContactName: '',
      groupContactNumber: '',
      transitAirport: '',
      destinationAirportCode: '',
      customDestinationAirport: '',
      needsLandTransport: false,
      passengers: [], // Will be fetched on demand
    }));
  } catch (err) {
    console.error('Ultra-Light fetch failed:', err);
    // Fallback to localStorage
    const localData = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
    return localData.sort((a: FormData, b: FormData) => 
      new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
    );
  }
}

// Helper function for retry logic with exponential backoff
const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3, initialDelay = 1000) => {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await Promise.race([
        fn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 30000) // 30 second timeout
        )
      ]);
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.log(`Retry attempt ${i + 1} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
};

// Helper functions for visa applications
export async function getAllApplications() {
  // Use Ultra-Light mode as primary method
  const ultraLightData = await getAllApplicationsUltraLight();
  
  // If Ultra-Light mode returns data, use it
  if (ultraLightData.length > 0) {
    return ultraLightData;
  }

  // Fallback to regular Supabase query if Ultra-Light returns nothing
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured, using localStorage fallback');
    const data = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
    return data.sort((a: FormData, b: FormData) => 
      new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
    );
  }

  try {
    console.log('Fetching applications list from Supabase (metadata only)...');
    const { data, error } = await retryWithBackoff(async () =>
      supabase
        .from('visa_applications')
        .select('id, submission_date, status, travel_type, group_contact_name, group_contact_number, transit_airport, destination_airport_code, custom_destination_airport, needs_land_transport')
        .order('submission_date', { ascending: false })
        .limit(100)
    );

    if (error) {
      console.error('Supabase query error:', error.message);
      const localData = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
      return localData.sort((a: FormData, b: FormData) => 
        new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
      );
    }

    console.log(`Successfully fetched ${data?.length || 0} applications from Supabase`);

    if (!data || data.length === 0) {
      return [];
    }

    return (data || []).map((app: any) => ({
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
      passengers: [],
    }));
  } catch (err) {
    console.error('Unexpected error fetching applications:', err);
    return [];
  }
}

// Fetch full application details including images (on demand)
export async function getApplicationDetails(id: string) {
  if (!isSupabaseConfigured()) {
    const data = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
    return data.find((s: FormData) => s.id === id) || null;
  }

  try {
    console.log(`Fetching full details for application ${id}...`);
    const { data, error } = await supabase
      .from('visa_applications')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching application details:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    let passengers = data.passengers || [];
    
    // Backward compatibility: if no passengers array but old fields exist, reconstruct from old format
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
  } catch (err) {
    console.error('Unexpected error fetching application details:', err);
    return null;
  }
}

// Fetch only passenger data for a specific application
export async function getApplicationPassengers(id: string) {
  if (!isSupabaseConfigured()) {
    const data = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
    const app = data.find((s: FormData) => s.id === id);
    return app?.passengers || [];
  }

  try {
    console.log(`Fetching passengers for application ${id}...`);
    const { data, error } = await supabase
      .from('visa_applications')
      .select('passengers')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching passengers:', error);
      return [];
    }

    return data?.passengers || [];
  } catch (err) {
    console.error('Unexpected error fetching passengers:', err);
    return [];
  }
}

export async function createApplication(application: Omit<FormData, 'id' | 'submissionDate'>) {
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured, saving to localStorage');
    const existing = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
    const newSubmission: FormData = {
      ...application,
      id: crypto.randomUUID(),
      submissionDate: new Date().toISOString(),
    };
    localStorage.setItem('visaSubmissions', JSON.stringify([...existing, newSubmission]));
    return newSubmission;
  }

  try {
    console.log('Creating application in Supabase...');
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
      console.error('Error creating application:', {
        message: error.message,
        code: error.code,
        details: error.details
      });
      throw error;
    }
    console.log('Application created successfully');
    return data;
  } catch (err) {
    console.error('Unexpected error creating application:', err);
    throw err;
  }
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

// Test Supabase connection and return detailed diagnostic information
export async function testSupabaseConnection() {
  const result = {
    configured: isSupabaseConfigured(),
    url: supabaseUrl ? 'Set' : 'Not set',
    key: supabaseKey ? 'Set' : 'Not set',
    connected: false,
    tableExists: false,
    recordCount: 0,
    error: null as any,
    details: {} as any
  };

  if (!result.configured) {
    result.error = 'Supabase is not configured';
    return result;
  }

  try {
    console.log('Testing Supabase connection...');
    
    // Test with direct HTTP fetch
    const response = await Promise.race([
      fetch(
        `${supabaseUrl}/rest/v1/visa_applications?select=count()&limit=1`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Accept': 'application/json',
          },
        }
      ),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection test timeout')), 10000)
      ) as Promise<Response>
    ]);

    if (!response.ok) {
      result.error = `HTTP ${response.status}: ${response.statusText}`;
      return result;
    }

    const data = await response.json();
    result.tableExists = true;
    result.recordCount = data?.[0]?.count || 0;
    result.connected = true;
    result.details = {
      message: `Successfully connected to Supabase. Found ${result.recordCount} total records.`,
    };

    console.log('Supabase connection test successful:', result);
    return result;
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'Unknown error';
    result.details = err;
    console.error('Unexpected error during connection test:', err);
    return result;
  }
}
