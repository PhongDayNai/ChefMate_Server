-- Migration 001: Create Pantries table
-- Run first - creates the new pantry container table
-- Status: SAFE (creates only, no modifications)

CREATE TABLE IF NOT EXISTS Pantries (
  pantryId INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  ownerUserId INT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_pantries_owner
    FOREIGN KEY (ownerUserId) REFERENCES Users(userId)
    ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_pantries_owner (ownerUserId)
) ENGINE=InnoDB;