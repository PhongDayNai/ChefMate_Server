-- Expand text columns to support long Vietnamese dataset values
USE chefmate_db;

ALTER TABLE Recipes
  MODIFY COLUMN recipeName VARCHAR(255) NOT NULL;

ALTER TABLE Tags
  MODIFY COLUMN tagName VARCHAR(255) NOT NULL;

ALTER TABLE Ingredients
  MODIFY COLUMN ingredientName VARCHAR(255) NOT NULL;
