-- Add separate toggles for Hourly Hope posting and visibility
ALTER TABLE "app_config"
ADD COLUMN "hourlyHopePostingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "hourlyHopeVisible" BOOLEAN NOT NULL DEFAULT true;

-- Keep behavior consistent with existing combined toggle value
UPDATE "app_config"
SET
  "hourlyHopePostingEnabled" = "hourlyHopeEnabled",
  "hourlyHopeVisible" = "hourlyHopeEnabled";
