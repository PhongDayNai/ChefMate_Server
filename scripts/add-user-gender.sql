-- Add gender column to Users and initialize existing data
ALTER TABLE Users
  ADD COLUMN gender ENUM('male', 'female', 'other', 'unknown') NOT NULL DEFAULT 'unknown' AFTER fullName;

-- Initial mapping for existing users created in seed/test data
UPDATE Users
SET gender = CASE userId
  WHEN 1 THEN 'male'
  WHEN 2 THEN 'female'
  WHEN 3 THEN 'male'
  WHEN 4 THEN 'female'
  WHEN 5 THEN 'male'
  WHEN 6 THEN 'male'
  WHEN 7 THEN 'female'
  WHEN 8 THEN 'male'
  WHEN 9 THEN 'female'
  WHEN 10 THEN 'male'
  WHEN 11 THEN 'male'
  WHEN 12 THEN 'female'
  WHEN 13 THEN 'male'
  WHEN 14 THEN 'female'
  WHEN 15 THEN 'male'
  WHEN 16 THEN 'female'
  WHEN 17 THEN 'male'
  WHEN 18 THEN 'female'
  WHEN 19 THEN 'male'
  WHEN 20 THEN 'female'
  ELSE 'unknown'
END;
