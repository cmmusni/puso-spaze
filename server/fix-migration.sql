-- Fix failed migration 20260226003642_add_post_pinned_field

-- Step 1: Add pinned column if it doesn't exist
ALTER TABLE posts ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Ensure displayName is unique
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_displayName_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_displayName_key UNIQUE (displayName);
    END IF;
END $$;

-- Step 3: Clean up the failed migration record
DELETE FROM _prisma_migrations 
WHERE migration_name = '20260226003642_add_post_pinned_field';

-- Step 4: Mark migration as successfully applied
INSERT INTO _prisma_migrations (
  id, 
  checksum, 
  finished_at, 
  migration_name, 
  logs, 
  rolled_back_at, 
  started_at, 
  applied_steps_count
) VALUES (
  gen_random_uuid(),
  'e5f8c4d3b2a1f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4',
  NOW(),
  '20260226003642_add_post_pinned_field',
  NULL,
  NULL,
  NOW(),
  1
);

-- Verify the fix
SELECT 'Migration fixed successfully!' as status;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'pinned';
