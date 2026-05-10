-- Migration 003: Backfill PantryItems with pantryId
-- Status: SAFE (adds nullable column, updates data, reversible)
-- Requires: migrations 001 & 002 completed

-- Step 1: Create default pantry for each existing user
-- Using INSERT IGNORE to handle if default pantry already exists
INSERT IGNORE INTO Pantries (name, ownerUserId)
SELECT 'My Pantry', userId FROM Users;

-- Step 2: Add pantryId column to PantryItems (nullable first - safe)
ALTER TABLE PantryItems ADD COLUMN pantryId INT NULL;

-- Step 3: Backfill pantryId for existing rows
-- This maps existing items to their owner's default pantry
UPDATE PantryItems pi
INNER JOIN Users u ON pi.userId = u.userId
INNER JOIN Pantries p ON p.ownerUserId = u.userId AND p.name = 'My Pantry'
SET pi.pantryId = p.pantryId
WHERE pi.pantryId IS NULL;

-- Step 4: Verify all rows were backfilled (should return 0)
-- SELECT COUNT(*) FROM PantryItems WHERE pantryId IS NULL;