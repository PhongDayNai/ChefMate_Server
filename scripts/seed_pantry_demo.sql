USE chefmate_db;

-- Demo pantry for userId = 1 (full inventory for end-to-end testing)
DELETE FROM PantryItems WHERE userId = 1;

INSERT INTO PantryItems (userId, ingredientId, quantity, unit, expiresAt)
SELECT 1, ingredientId, 10000, 'g', NULL
FROM Ingredients;
