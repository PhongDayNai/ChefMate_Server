-- Rollback script for Pantry Sharing migration
-- Status: DESTRUCTIVE - restores schema and data
-- Use ONLY if migration must be rolled back

-- Step 1: Restore userId column
ALTER TABLE PantryItems ADD COLUMN userId INT NOT NULL;

-- Step 2: Restore userId values from default pantry mapping
UPDATE PantryItems pi
INNER JOIN Pantries p ON pi.pantryId = p.pantryId
SET pi.userId = p.ownerUserId;

-- Step 3: Re-add FK to Users
ALTER TABLE PantryItems
  ADD CONSTRAINT fk_pantry_user
  FOREIGN KEY (userId) REFERENCES Users(userId)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- Step 4: Drop pantryId column (make nullable first to avoid constraint issues)
ALTER TABLE PantryItems MODIFY pantryId INT NULL;
ALTER TABLE PantryItems DROP COLUMN pantryId;

-- Step 5: Re-add original unique constraint
ALTER TABLE PantryItems ADD UNIQUE KEY uq_pantry_user_ingredient_unit (userId, ingredientId, unit);

-- NOTE: Pantries and PantryShares tables are NOT dropped automatically
-- Run manually if needed:
-- DROP TABLE IF EXISTS PantryShares;
-- DROP TABLE IF EXISTS Pantries;