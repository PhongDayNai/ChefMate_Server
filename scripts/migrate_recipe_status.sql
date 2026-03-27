USE chefmate_db;

-- Add moderation status for recipes (idempotent)
SET @has_status := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Recipes' AND COLUMN_NAME = 'status'
);

SET @sql_add_status := IF(
  @has_status = 0,
  "ALTER TABLE Recipes ADD COLUMN status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved' AFTER viewCount",
  'SELECT 1'
);

PREPARE stmt FROM @sql_add_status; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill any NULL/empty values if legacy data exists
UPDATE Recipes
SET status = 'approved'
WHERE status IS NULL OR status = '';
