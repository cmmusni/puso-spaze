-- DropIndex
DROP INDEX "users_pin_key";
-- DropUniqueConstraint (handle both index and constraint forms)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_pin_key'
  ) THEN
    ALTER TABLE "users" DROP CONSTRAINT "users_pin_key";
  ELSIF EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'users_pin_key'
  ) THEN
    DROP INDEX "users_pin_key";
  END IF;
END $$;
