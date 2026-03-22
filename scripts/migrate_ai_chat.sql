USE chefmate_db;

SET @has_isMain := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'RecipesIngredients'
    AND COLUMN_NAME = 'isMain'
);
SET @sql_isMain := IF(
  @has_isMain = 0,
  'ALTER TABLE RecipesIngredients ADD COLUMN isMain TINYINT(1) NOT NULL DEFAULT 0 AFTER unit',
  'SELECT 1'
);
PREPARE stmt FROM @sql_isMain;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_isCommon := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'RecipesIngredients'
    AND COLUMN_NAME = 'isCommon'
);
SET @sql_isCommon := IF(
  @has_isCommon = 0,
  'ALTER TABLE RecipesIngredients ADD COLUMN isCommon TINYINT(1) NOT NULL DEFAULT 0 AFTER isMain',
  'SELECT 1'
);
PREPARE stmt FROM @sql_isCommon;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS PantryItems (
  pantryItemId INT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,
  ingredientId INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL,
  expiresAt DATETIME NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pantry_user FOREIGN KEY (userId) REFERENCES Users(userId)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_pantry_ingredient FOREIGN KEY (ingredientId) REFERENCES Ingredients(ingredientId)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  UNIQUE KEY uq_pantry_user_ingredient_unit (userId, ingredientId, unit)
);

CREATE TABLE IF NOT EXISTS ChatSessions (
  chatSessionId INT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT 'Phiên chat nấu ăn',
  activeRecipeId INT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_chat_session_user FOREIGN KEY (userId) REFERENCES Users(userId)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_chat_session_active_recipe FOREIGN KEY (activeRecipeId) REFERENCES Recipes(recipeId)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ChatMessages (
  chatMessageId INT PRIMARY KEY AUTO_INCREMENT,
  chatSessionId INT NOT NULL,
  role ENUM('system', 'user', 'assistant') NOT NULL,
  content TEXT NOT NULL,
  metaJson JSON NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chat_message_session FOREIGN KEY (chatSessionId) REFERENCES ChatSessions(chatSessionId)
    ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_chat_messages_session_created (chatSessionId, createdAt)
);
