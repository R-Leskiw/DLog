-- Database Schema for Supabase (PostgreSQL)
-- For incremental changes applied after initial create, see supabase/migrations/

-- 1. Profiles Table (Extends Supabase Auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT CHECK (role IN ('employee', 'client')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1b. Jobs (sites / contracts a daily log applies to)
CREATE TABLE jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Daily Logs Table
CREATE TABLE daily_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id),
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  title TEXT,
  date DATE DEFAULT CURRENT_DATE,
  weather TEXT,
  work_performed TEXT,
  crew_on_site TEXT,
  issues_delays TEXT,
  image_urls TEXT[], -- Array of URLs from Supabase Storage (bucket: log-images)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Comments Table (threaded feedback on Logs)
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  log_id UUID REFERENCES daily_logs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Messages Table (Internal Chat)
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
