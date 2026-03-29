USE chefmate_db;

CREATE TABLE IF NOT EXISTS ChatSessionRecipes (
  chatSessionRecipeId INT PRIMARY KEY AUTO_INCREMENT,
  chatSessionId INT NOT NULL,
  recipeId INT NOT NULL,
  sortOrder INT NOT NULL DEFAULT 1,
  status ENUM('pending','cooking','done','skipped') NOT NULL DEFAULT 'pending',
  servingsOverride DECIMAL(10,2) NULL,
  note VARCHAR(500) NULL,
  selectedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolvedAt DATETIME NULL,
  CONSTRAINT fk_chat_session_recipes_session FOREIGN KEY (chatSessionId) REFERENCES ChatSessions(chatSessionId)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_chat_session_recipes_recipe FOREIGN KEY (recipeId) REFERENCES Recipes(recipeId)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  UNIQUE KEY uq_chat_session_recipe (chatSessionId, recipeId),
  INDEX idx_chat_session_recipes_session_sort (chatSessionId, sortOrder),
  INDEX idx_chat_session_recipes_status (status)
);
