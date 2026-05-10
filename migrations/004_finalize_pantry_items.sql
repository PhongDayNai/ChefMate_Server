-- Migration 004: Finalize PantryItems schema
-- Status: DESTRUCTIVE (adds NOT NULL, drops columns - ensure backup exists)
-- Requires: migrations 001, 002, 003 completed and verified

-- Step 4: Add NOT NULL constraint (already done during backfill in some cases)
ALTER TABLE PantryItems MODIFY pantryId INT NOT NULL;

-- Step 5: Add FK constraint to Pantries (if not already added)
ALTER TABLE PantryItems
  ADD CONSTRAINT fk_pantryitems_pantry
  FOREIGN KEY (pantryId) REFERENCES Pantries(pantryId)
  ON UPDATE CASCADE ON DELETE CASCADE,
  ADD INDEX idx_pantryitems_pantry (pantryId);

-- Step 6: Drop old FK to Users (may not exist if already dropped)
-- ALTER TABLE PantryItems DROP FOREIGN KEY fk_pantry_user;

-- Step 7: Drop old userId column (may not exist if already dropped)
-- ALTER TABLE PantryItems DROP COLUMN userId;

-- Step 8: Update unique constraint to use pantryId instead of userId
-- First drop FK on ingredientId to allow dropping unique key
ALTER TABLE PantryItems DROP FOREIGN KEY fk_pantry_ingredient;

-- Drop old unique key (may fail if already dropped - use IF EXISTS)
-- ALTER TABLE PantryItems DROP INDEX uq_pantry_user_ingredient_unit;

-- Add new unique key with pantryId
ALTER TABLE PantryItems ADD UNIQUE KEY uq_pantry_ingredient_unit (pantryId, ingredientId, unit);

-- Re-add FK on ingredientId
ALTER TABLE PantryItems ADD CONSTRAINT fk_pantry_ingredient FOREIGN KEY (ingredientId) REFERENCES Ingredients(ingredientId) ON DELETE RESTRICT ON UPDATE CASCADE;