import { createClient } from '@supabase/supabase-js';
import type { FormData } from '@/types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseKey);
};

// Only create the client when credentials are present.
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      },
      // Disable realtime WebSocket — not used, causes extra connections on
      // free-tier / paused projects.
      realtime: { params: { eventsPerSecond: 0 } },
    })
  : (null as unknown as ReturnType<typeof createClient>);

// ---------------------------------------------------------------------------
// Typed error class — lets callers distinguish a Supabase failure from a
// genuine "no records" result.
// ---------------------------------------------------------------------------
export class SupabaseFetchError extends Error {
  readonly code: string;
  readonly details: string;
  constructor(message: string, code = '', details = '') {
    super(message);
    this.name = 'SupabaseFetchError';
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Pagination constants
// ---------------------------------------------------------------------------
export const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Internal helper: retry with exponential back-off.
// Retries on BOTH thrown exceptions AND Supabase { error } response values.
// Skips retries for definitive auth / permission errors.
// ---------------------------------------------------------------------------
const NON_RETRYABLE_CODES = new Set(['PGRST301', '42501', 'invalid_api_key']);

// Wrap a Supabase query with a timeout so hung connections (e.g. HTTP 521)
// fail fast instead of spinning for 60+ seconds.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

async function withRetry<D>(
  fn: () => Promise<{ data: D; error: any }>,
  maxAttempts = 3,
  baseDelayMs = 1000,
  timeoutMs = 15000
): Promise<{ data: D; error: any }> {
  let lastResult: { data: D; error: any } = { data: null as unknown as D, error: null };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await withTimeout(fn(), timeoutMs);
      if (result.error) {
        lastResult = result;
        if (NON_RETRYABLE_CODES.has(result.error.code)) return result;
        if (attempt < maxAttempts) {
          const delay = baseDelayMs * 2 ** (attempt - 1);
          console.warn(`Supabase error on attempt ${attempt}/${maxAttempts}, retrying in ${delay}ms…`, result.error.message);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }
      return result;
    } catch (err: any) {
      lastResult = { data: null as unknown as D, error: err };
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * 2 ** (attempt - 1);
        console.warn(`Network error on attempt ${attempt}/${maxAttempts}, retrying in ${delay}ms…`, err?.message ?? err);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  return lastResult;
}

// ---------------------------------------------------------------------------
// Row mapper — converts a raw Supabase row to the app's FormData shape
// ---------------------------------------------------------------------------
function mapRow(r: any): FormData {
  return {
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
  };
}

// ---------------------------------------------------------------------------
// Public API — Paginated lazy loading
// ---------------------------------------------------------------------------

/**
 * Result shape returned by getApplicationsPage().
 */
export interface ApplicationsPage {
  /** Records for this page */
  items: FormData[];
  /** Total number of records matching the current filters (for "X of Y" display) */
  total: number;
  /** True when there are more pages to load */
  hasMore: boolean;
}

/**
 * Fetch a single page of applications.
 *
 * @param page  0-based page index
 * @param pageSize  Number of records per page (default: PAGE_SIZE = 10)
 *
 * Throws SupabaseFetchError on failure so the caller can show an error state.
 * Falls back to localStorage when Supabase is not configured.
 */
export async function getApplicationsPage(
  page = 0,
  pageSize = PAGE_SIZE
): Promise<ApplicationsPage> {
  // ── localStorage fallback ──────────────────────────────────────────────
  if (!isSupabaseConfigured()) {
    const all: FormData[] = JSON.parse(localStorage.getItem('visaSubmissions') || '[]')
      .sort((a: FormData, b: FormData) =>
        new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
      );
    const start = page * pageSize;
    return {
      items: all.slice(start, start + pageSize),
      total: all.length,
      hasMore: start + pageSize < all.length,
    };
  }

  // ── Supabase paginated query ───────────────────────────────────────────
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await withRetry(() =>
    supabase
      .from('visa_applications')
      .select(
        'id,submission_date,status,travel_type,group_contact_name,group_contact_number,transit_airport,destination_airport_code,custom_destination_airport,needs_land_transport,passengers',
        { count: 'exact' }
      )
      .order('submission_date', { ascending: false })
      .range(from, to) as unknown as Promise<{ data: any[]; error: any; count: number | null }>
  ) as unknown as { data: any[] | null; error: any; count: number | null };

  if (error) {
    throw new SupabaseFetchError(
      error.message || 'Failed to fetch applications',
      error.code || '',
      error.details || ''
    );
  }

  const items = (data || []).map(mapRow);
  // Supabase returns the total count alongside the page when count:'exact' is set
  const total = (data as any)?.count ?? items.length;
  return {
    items,
    total,
    hasMore: from + items.length < total,
  };
}

/** Fetch full application details including images (on demand). */
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
