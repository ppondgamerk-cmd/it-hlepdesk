-- ==========================================
-- IT HELPDESK SYSTEM - DATABASE INITIALIZATION
-- Copy and paste this script inside your Supabase SQL Editor to seed tables.
-- ==========================================

-- 1. Create users table
CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL
);

-- 2. Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    reporter TEXT NOT NULL,
    department TEXT NOT NULL,
    equipment TEXT,
    details TEXT NOT NULL,
    urgency TEXT NOT NULL,
    status TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    image TEXT,
    resolution TEXT,
    "resolvedAt" TIMESTAMP WITH TIME ZONE,
    logs JSONB DEFAULT '[]'::jsonb
);

-- 3. Insert default seed user accounts
INSERT INTO users (username, password, name, role) VALUES
('it_staff', 'itpassword', 'it staff', 'staff'),
('user1', 'userpassword', 'user', 'user'),
('user2', 'userpassword', 'สมหญิง รักเรียน', 'user')
ON CONFLICT (username) DO NOTHING;

-- Ticket data starts empty; no sample requests are inserted.
