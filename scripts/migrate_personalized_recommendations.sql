USE chefmate_db;

CREATE TABLE IF NOT EXISTS RecipeProfiles (
  recipeProfileId INT PRIMARY KEY AUTO_INCREMENT,
  recipeId INT NOT NULL,
  flavorJson JSON NOT NULL,
  cookingMethodsJson JSON NOT NULL,
  nutritionSignalsJson JSON NOT NULL,
  mealContextsJson JSON NULL,
  wellnessFlagsJson JSON NULL,
  difficultyScore DECIMAL(4,2) NULL,
  profilingSource ENUM('manual', 'rule', 'ai', 'hybrid') NOT NULL DEFAULT 'rule',
  confidenceScore DECIMAL(4,2) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_recipe_profiles_recipe FOREIGN KEY (recipeId) REFERENCES Recipes(recipeId)
    ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE KEY uq_recipe_profile_recipe (recipeId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS UserEatingSignals (
  signalId BIGINT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,
  recipeId INT NULL,
  signalType ENUM(
    'recipe_view',
    'recipe_like',
    'recipe_unlike',
    'cook_started',
    'cook_completed',
    'cook_abandoned',
    'recommendation_impression',
    'recommendation_click',
    'recommendation_accept',
    'feedback_positive',
    'feedback_negative',
    'feedback_too_spicy',
    'feedback_too_oily',
    'feedback_too_heavy',
    'feedback_light_preferred'
  ) NOT NULL,
  signalWeight DECIMAL(6,2) NOT NULL DEFAULT 1,
  source ENUM('app', 'chat', 'system', 'admin') NOT NULL DEFAULT 'app',
  contextJson JSON NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_eating_signals_user FOREIGN KEY (userId) REFERENCES Users(userId)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_user_eating_signals_recipe FOREIGN KEY (recipeId) REFERENCES Recipes(recipeId)
    ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_user_eating_signals_user_created (userId, createdAt),
  INDEX idx_user_eating_signals_recipe_created (recipeId, createdAt),
  INDEX idx_user_eating_signals_type_created (signalType, createdAt)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS UserTasteProfiles (
  userId INT PRIMARY KEY,
  tasteVectorJson JSON NOT NULL,
  recentTasteVectorJson JSON NULL,
  balanceSignalsJson JSON NULL,
  profileConfidence DECIMAL(4,2) NULL,
  lastSignalAt DATETIME NULL,
  computedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  version INT NOT NULL DEFAULT 1,
  CONSTRAINT fk_user_taste_profiles_user FOREIGN KEY (userId) REFERENCES Users(userId)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS UserEatingInsights (
  insightId BIGINT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,
  insightType ENUM('habit_summary', 'balance_alert', 'weekly_pattern', 'pantry_opportunity', 'recommendation_hint') NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  priority TINYINT NOT NULL DEFAULT 0,
  metaJson JSON NULL,
  validFrom DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  validUntil DATETIME NULL,
  generatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_eating_insights_user FOREIGN KEY (userId) REFERENCES Users(userId)
    ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_user_eating_insights_user_valid (userId, validUntil, priority)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS RecommendationSnapshots (
  snapshotId BIGINT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,
  requestContext VARCHAR(50) NOT NULL,
  inputMetaJson JSON NULL,
  outputJson JSON NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recommendation_snapshots_user FOREIGN KEY (userId) REFERENCES Users(userId)
    ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_recommendation_snapshots_user_created (userId, createdAt)
) ENGINE=InnoDB;
