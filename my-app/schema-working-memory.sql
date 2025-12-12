-- Working Memory Schema for PostgreSQL
-- Run this script to create the working_memory table
-- This table stores persistent working memory for agent sessions

-- Working memory table
-- Stores key-value pairs per user and thread for agent context
CREATE TABLE IF NOT EXISTS working_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, thread_id, key)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_working_memory_user_id ON working_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_working_memory_thread_id ON working_memory(thread_id);
CREATE INDEX IF NOT EXISTS idx_working_memory_user_thread ON working_memory(user_id, thread_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_working_memory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on changes
DROP TRIGGER IF EXISTS working_memory_update_timestamp ON working_memory;
CREATE TRIGGER working_memory_update_timestamp
  BEFORE UPDATE ON working_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_working_memory_timestamp();
