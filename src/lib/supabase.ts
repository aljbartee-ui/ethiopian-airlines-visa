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
  if (!isSupabaseConfigured()) {
    // Fallback to localStorage
    console.log('Supabase not configured, using localStorage fallback');
    const data = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
    return data.sort((a: FormData, b: FormData) => 
      new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
    );
  }

  try {
    console.log('Fetching applications list from Supabase (metadata only)...');
    // Fetch ONLY metadata, completely excluding the heavy 'passengers' field which contains all images
    const { data, error } = await retryWithBackoff(async () =>
      supabase
        .from('visa_applications')
        .select('id, submission_date, status, travel_type, group_contact_name, group_contact_number, transit_airport, destination_airport_code, custom_destination_airport, needs_land_transport')
        .order('submission_date', { ascending: false })
    );

    if (error) {
      console.error('Supabase query error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        status: error.status
      });
      // Fallback to localStorage if Supabase fails
      console.log('Falling back to localStorage...');
      const localData = JSON.parse(localStorage.getItem('visaSubmissions') || '[]');
      return localData.sort((a: FormData, b: FormData) => 
        new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
      );
    }

    console.log(`Successfully fetched ${data?.length || 0} applications from Supabase`);

    // Map snake_case from Supabase to camelCase for the frontend
    if (!data || data.length === 0) {
      console.log('No applications found in Supabase');
      return [];
    }

    return (data || []).map((app: any) => {
      // Return minimal data for the list view - passengers will be fetched on demand
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
        passengers: [], // Empty for now, will be fetched on demand
      };
    });
  } catch (err) {
    console.error('Unexpected error fetching applications:', err);
    return [];
  }
}

// Fetch full application details including images (on demand)
export async function getApplicationDetails(id: string) {
  if (!isSupabaseConfigured()) {
    // Fallback to localStorage
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
    // Fallback to localStorage
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
    // Fallback to localStorage
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
    
    // Test 1: Try to fetch count
    const { count, error: countError } = await supabase
      .from('visa_applications')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      result.error = countError.message;
      result.details = countError;
      console.error('Count query failed:', countError);
      return result;
    }

    result.tableExists = true;
    result.recordCount = count || 0;

    // Test 2: Try to fetch one record
    const { data, error: dataError } = await supabase
      .from('visa_applications')
      .select('id, submission_date, status')
      .limit(1);

    if (dataError) {
      result.error = dataError.message;
      result.details = dataError;
      console.error('Data query failed:', dataError);
      return result;
    }

    result.connected = true;
    result.details = {
      message: `Successfully connected to Supabase. Found ${result.recordCount} total records.`,
      sampleRecord: data?.[0] || 'No records found'
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
