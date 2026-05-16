-- Migration 005: Add pantryId to ChatSessions
-- Status: NON-DESTRUCTIVE (adds nullable column, safe to run)
-- Requires: migration 004 completed

-- Step 1: Add pantryId column (nullable for backward compatibility)
ALTER TABLE ChatSessions
  ADD COLUMN pantryId INT NULL
  AFTER userId;

-- Step 2: Add index for efficient queries
ALTER TABLE ChatSessions
  ADD INDEX idx_chatsession_pantry (pantryId),
  ADD INDEX idx_chatsession_user_pantry (userId, pantryId);

-- Step 3: Add FK constraint (optional, can be added after migration is verified)
-- ALTER TABLE ChatSessions
--   ADD CONSTRAINT fk_chatsession_pantry
--   FOREIGN KEY (pantryId) REFERENCES Pantries(pantryId)
--   ON UPDATE CASCADE ON DELETE SET NULL;