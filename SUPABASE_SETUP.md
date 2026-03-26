# Supabase Setup Guide

## Problem: Data Not Shared Between Team Members

The current app uses browser localStorage, which stores data only on each user's device. This means:
- ❌ Your colleagues can't see your submissions
- ❌ Data is lost if browser cache is cleared
- ❌ No real-time collaboration

## Solution: Supabase Cloud Database

Supabase provides a free cloud PostgreSQL database that all team members can access.

---

## Step 1: Create Supabase Account

1. Go to https://supabase.com
2. Click **Start your project**
3. Sign up with GitHub (recommended)
4. Verify your email

---

## Step 2: Create New Project

1. Click **New Project**
2. Organization: Choose or create one
3. Project name: `ethiopian-airlines-visa`
4. Database password: Generate a strong password (save it!)
5. Region: Choose closest to Kuwait (e.g., `Middle East (Dubai)` or `EU (Frankfurt)`)
6. Click **Create new project**
7. Wait 1-2 minutes for the database to be ready

---

## Step 3: Get API Keys

1. In your project dashboard, click the **Settings** icon (gear) on left sidebar
2. Click **API** in the menu
3. Copy these values:
   - **Project URL** (e.g., `https://xxxxxxxxxxxx.supabase.co`)
   - **anon/public** key (long string starting with `eyJ...`)

---

## Step 4: Create Database Table

1. In Supabase dashboard, click **SQL Editor** on left sidebar
2. Click **New query**
3. Paste this SQL:

```sql
-- Create the visa applications table
CREATE TABLE visa_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending',
  travel_type TEXT,
  group_contact_name TEXT,
  group_contact_number TEXT,
  transit_airport TEXT,
  destination_airport_code TEXT,
  custom_destination_airport TEXT,
  needs_land_transport BOOLEAN DEFAULT FALSE,
  passengers JSONB,
  civil_id_file TEXT,
  civil_id_file_name TEXT,
  passport_file TEXT,
  passport_file_name TEXT,
  photo_file TEXT,
  photo_file_name TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE visa_applications ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (for admin use)
CREATE POLICY "Allow all operations" ON visa_applications
  FOR ALL USING (true) WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_submission_date ON visa_applications(submission_date DESC);
CREATE INDEX idx_status ON visa_applications(status);
```

4. Click **Run** (or press Ctrl+Enter)

---

## Step 5: Configure Your App

### Option A: Environment Variables (Recommended for Render)

1. In your Render dashboard, go to your service
2. Click **Environment** tab
3. Add these variables:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | Your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |

4. Click **Save Changes**
5. Click **Manual Deploy** → **Deploy latest commit**

### Option B: Hardcode in Code (Quick test only)

Edit `src/lib/supabase.ts`:

```typescript
const supabaseUrl = 'https://your-project-url.supabase.co';
const supabaseKey = 'your-anon-key';
```

⚠️ **Warning**: Don't commit API keys to GitHub! Use environment variables for production.

---

## Step 6: Test

1. Open your deployed app
2. Submit a test application
3. Check Supabase: Go to **Table Editor** → `visa_applications`
4. You should see the new row!
5. Ask a colleague to open the admin page - they should see the same data

---

## Troubleshooting

### "Failed to submit application"
- Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly
- Check browser console for error details
- Verify the table was created in SQL Editor

### Data still not shared
- Make sure all team members are using the same deployed URL
- Check that Supabase is configured (you'll see "Cloud Sync" in admin header)

### Images not showing
- Large images may exceed database limits
- Consider using Supabase Storage for images (advanced)

---

## Free Tier Limits

Supabase free tier includes:
- 500MB database storage
- 2GB bandwidth/month
- Unlimited API requests
- Perfect for small teams (< 1000 applications/month)

---

## Security Note

The current setup allows anyone with the anon key to read/write data. For production:
1. Enable Row Level Security policies
2. Add authentication if needed
3. Consider using Supabase Auth for admin login
