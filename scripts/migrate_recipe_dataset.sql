USE chefmate_db;

-- Recipes: add external metadata columns for imported datasets
SET @has_externalSourceId := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Recipes' AND COLUMN_NAME = 'externalSourceId'
);
SET @sql_externalSourceId := IF(
  @has_externalSourceId = 0,
  'ALTER TABLE Recipes ADD COLUMN externalSourceId VARCHAR(64) NULL AFTER recipeId',
  'SELECT 1'
);
PREPARE stmt FROM @sql_externalSourceId; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_category := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Recipes' AND COLUMN_NAME = 'category'
);
SET @sql_category := IF(
  @has_category = 0,
  'ALTER TABLE Recipes ADD COLUMN category VARCHAR(100) NULL AFTER recipeName',
  'SELECT 1'
);
PREPARE stmt FROM @sql_category; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_area := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Recipes' AND COLUMN_NAME = 'area'
);
SET @sql_area := IF(
  @has_area = 0,
  'ALTER TABLE Recipes ADD COLUMN area VARCHAR(100) NULL AFTER category',
  'SELECT 1'
);
PREPARE stmt FROM @sql_area; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_sourceUrl := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Recipes' AND COLUMN_NAME = 'sourceUrl'
);
SET @sql_sourceUrl := IF(
  @has_sourceUrl = 0,
  'ALTER TABLE Recipes ADD COLUMN sourceUrl VARCHAR(1000) NULL AFTER image',
  'SELECT 1'
);
PREPARE stmt FROM @sql_sourceUrl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_youtubeUrl := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Recipes' AND COLUMN_NAME = 'youtubeUrl'
);
SET @sql_youtubeUrl := IF(
  @has_youtubeUrl = 0,
  'ALTER TABLE Recipes ADD COLUMN youtubeUrl VARCHAR(1000) NULL AFTER sourceUrl',
  'SELECT 1'
);
PREPARE stmt FROM @sql_youtubeUrl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_instructions := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Recipes' AND COLUMN_NAME = 'instructions'
);
SET @sql_instructions := IF(
  @has_instructions = 0,
  'ALTER TABLE Recipes ADD COLUMN instructions LONGTEXT NULL AFTER youtubeUrl',
  'SELECT 1'
);
PREPARE stmt FROM @sql_instructions; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Make recipe name longer to avoid truncation for imported dataset
ALTER TABLE Recipes MODIFY COLUMN recipeName VARCHAR(255) NOT NULL;

-- Better support ingredient quantity/unit precision
ALTER TABLE RecipesIngredients MODIFY COLUMN weight DECIMAL(10,2) NOT NULL;
ALTER TABLE RecipesIngredients MODIFY COLUMN unit VARCHAR(60) NOT NULL;

-- Add unique index for external recipe id if not exists
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Recipes' AND INDEX_NAME = 'uq_recipes_external_source_id'
);
SET @sql_add_idx := IF(
  @idx_exists = 0,
  'CREATE UNIQUE INDEX uq_recipes_external_source_id ON Recipes (externalSourceId)',
  'SELECT 1'
);
PREPARE stmt FROM @sql_add_idx; EXECUTE stmt; DEALLOCATE PREPARE stmt;
