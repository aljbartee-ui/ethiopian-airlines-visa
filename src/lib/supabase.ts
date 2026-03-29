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

// Only create the Supabase client if credentials are provided.
// @supabase/supabase-js v2.100+ throws when called with empty strings,
// which would crash the entire module and produce a blank page.
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseKey)
  : (null as unknown as ReturnType<typeof createClient>);

// Get list of application IDs only (no data, just IDs)
export async function getApplicationIds() {
  if (!isSupabaseConfigured()) {
    const data = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
    return data.map((app: FormData) => app.id);
  }

  try {
    console.log('Fetching application IDs only...');
    
    const response = await Promise.race([
      fetch(
        `${supabaseUrl}/rest/v1/visa_applications?select=id&order=submission_date.desc&limit=100`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Accept': 'application/json',
          },
        }
      ),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('ID fetch timeout')), 10000)
      ) as Promise<Response>
    ]);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`Successfully fetched ${data?.length || 0} application IDs`);
    return (data || []).map((app: any) => app.id);
  } catch (err) {
    console.error('Failed to fetch application IDs:', err);
    return [];
  }
}

// Fetch a single application's metadata (ID, Date only)
export async function getApplicationMetadata(id: string) {
  if (!isSupabaseConfigured()) {
    const data = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
    const app = data.find((a: FormData) => a.id === id);
    return app ? { id: app.id, submissionDate: app.submissionDate } : null;
  }

  try {
    const response = await Promise.race([
      fetch(
        `${supabaseUrl}/rest/v1/visa_applications?select=id,submission_date&eq=id.${id}`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Accept': 'application/json',
          },
        }
      ),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Metadata fetch timeout')), 8000)
      ) as Promise<Response>
    ]);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data && data.length > 0) {
      return {
        id: data[0].id,
        submissionDate: data[0].submission_date
      };
    }
    return null;
  } catch (err) {
    console.error(`Failed to fetch metadata for ${id}:`, err);
    return null;
  }
}

// Helper functions for visa applications
export async function getAllApplications() {
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured, using localStorage fallback');
    const data = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
    return data.sort((a: FormData, b: FormData) => 
      new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
    );
  }

  try {
    console.log('Fetching applications using Single-Record Recovery mode...');
    
    // Step 1: Get all application IDs
    const ids = await getApplicationIds();
    console.log(`Found ${ids.length} application IDs`);
    
    if (ids.length === 0) {
      return [];
    }

    // Step 2: Fetch metadata for each ID one at a time
    const applications: FormData[] = [];
    for (const id of ids) {
      try {
        const metadata = await getApplicationMetadata(id);
        if (metadata) {
          applications.push({
            id: metadata.id,
            submissionDate: metadata.submissionDate,
            status: 'pending' as const,
            travelType: 'individual' as const,
            groupContactName: '',
            groupContactNumber: '',
            transitAirport: '',
            destinationAirportCode: '',
            customDestinationAirport: '',
            needsLandTransport: false,
            passengers: [],
          });
        }
      } catch (err) {
        console.error(`Failed to fetch metadata for ${id}:`, err);
        // Continue with the next ID
      }
    }

    console.log(`Successfully recovered ${applications.length} applications`);
    return applications;
  } catch (err) {
    console.error('Unexpected error in Single-Record Recovery mode:', err);
    // Fallback to localStorage
    const localData = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
    return localData.sort((a: FormData, b: FormData) => 
      new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
    );
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
    
    // Test with direct HTTP fetch - just get IDs
    const response = await Promise.race([
      fetch(
        `${supabaseUrl}/rest/v1/visa_applications?select=id&limit=1`,
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

    result.tableExists = true;
    result.connected = true;
    result.details = {
      message: `Successfully connected to Supabase.`,
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
