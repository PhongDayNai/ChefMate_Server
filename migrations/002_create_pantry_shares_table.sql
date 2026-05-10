-- Migration 002: Create PantryShares table
-- Run second - creates the sharing join table
-- Status: SAFE (creates only, no modifications)

CREATE TABLE IF NOT EXISTS PantryShares (
  pantryId INT NOT NULL,
  userId INT NOT NULL,
  role ENUM('viewer', 'editor') NOT NULL DEFAULT 'viewer',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (pantryId, userId),

  CONSTRAINT fk_pantryshares_pantry
    FOREIGN KEY (pantryId) REFERENCES Pantries(pantryId)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_pantryshares_user
    FOREIGN KEY (userId) REFERENCES Users(userId)
    ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_pantryshares_user (userId),
  INDEX idx_pantryshares_pantry (pantryId)
) ENGINE=InnoDB;