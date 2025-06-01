CREATE DATABASE ChefMateDB;

CREATE TABLE Users(
  userId INT PRIMARY KEY IDENTITY(1,1),
  fullName NVARCHAR(100) NOT NULL,
  phone NVARCHAR(10) NOT NULL UNIQUE,
  passwordHash NVARCHAR(255) NOT NULL,
  createAt DATETIME DEFAULT GETDATE()
);

CREATE TABLE Recipes(
  recipeId INT PRIMARY KEY IDENTITY(1,1),
  recipeName NVARCHAR(100) NOT NULL,
  image NVARCHAR(1000) NOT NULL,
  likeQuantity INT DEFAULT 0,
  userId INT FOREIGN KEY REFERENCES Users(userId)
);

CREATE TABLE Ingredients(
  ingredientId INT PRIMARY KEY IDENTITY(1,1),
  ingredientName NVARCHAR(100) NOT NULL
);

CREATE TABLE RecipesIngredients(
  riId INT PRIMARY KEY IDENTITY(1,1),
  recipeId INT FOREIGN KEY REFERENCES Recipes(recipeId),
  ingredientId INT FOREIGN KEY REFERENCES Ingredients(ingredientId),
  weight INT NOT NULL,
  unit NVARCHAR(20) NOT NULL
);

CREATE TABLE CookingSteps(
  csId INT PRIMARY KEY IDENTITY(1, 1),
  recipeId INT FOREIGN KEY REFERENCES Recipes(recipeId),
  indexStep INT NOT NULL,
  content NVARCHAR(4000) NOT NULL
);

CREATE TABLE UsersViewRecipesHistory(
  uvrId INT PRIMARY KEY IDENTITY(1, 1),
  userId INT FOREIGN KEY REFERENCES Users(userId),
  recipeId INT FOREIGN KEY REFERENCES Recipes(recipeId)
);

CREATE TABLE UsersLike(
  ulId INT PRIMARY KEY IDENTITY(1, 1),
  userId INT FOREIGN KEY REFERENCES Users(userId),
  recipeId INT FOREIGN KEY REFERENCES Recipes(recipeId)
);

CREATE TABLE UsersComment(
  ucId INT PRIMARY KEY IDENTITY(1, 1),
  userId INT FOREIGN KEY REFERENCES Users(userId),
  recipeId INT FOREIGN KEY REFERENCES Recipes(recipeId),
  content NVARCHAR(4000) NOT NULL,
  createdAt DATE DEFAULT GETDATE()
);


-- Lấy thông tin từ recipeId
SELECT 
    r.recipeId,
    r.recipeName,
    r.image,
    r.likeQuantity
FROM Recipes r
WHERE r.recipeId = 1;

SELECT 
    cs.indexStep,
    cs.content AS stepContent
FROM Recipes r
LEFT JOIN CookingSteps cs ON r.recipeId = cs.recipeId
WHERE r.recipeId = 1
ORDER BY cs.indexStep;

SELECT 
    i.ingredientId,
    i.ingredientName,
    ri.weight,
    ri.unit
FROM Recipes r
LEFT JOIN RecipesIngredients ri ON r.recipeId = ri.recipeId
LEFT JOIN Ingredients i ON ri.ingredientId = i.ingredientId
WHERE r.recipeId = 1;


-- Lấy thông tin tựa như recipeName
SELECT 
    r.recipeId,
    r.recipeName,
    r.image,
    r.likeQuantity
FROM Recipes r
WHERE r.recipeName COLLATE SQL_Latin1_General_CP1_CI_AI LIKE '%' + 'ga' COLLATE SQL_Latin1_General_CP1_CI_AI + '%';

SELECT 
    r.recipeId,
    cs.indexStep,
    cs.content AS stepContent
FROM Recipes r
LEFT JOIN CookingSteps cs ON r.recipeId = cs.recipeId
WHERE r.recipeName COLLATE SQL_Latin1_General_CP1_CI_AI LIKE '%' + 'ga' COLLATE SQL_Latin1_General_CP1_CI_AI + '%'
ORDER BY cs.indexStep;

SELECT 
    r.recipeId,
    i.ingredientId,
    i.ingredientName,
    ri.weight,
    ri.unit
FROM Recipes r
LEFT JOIN RecipesIngredients ri ON r.recipeId = ri.recipeId
LEFT JOIN Ingredients i ON ri.ingredientId = i.ingredientId
WHERE r.recipeName COLLATE SQL_Latin1_General_CP1_CI_AI LIKE '%' + 'ga' COLLATE SQL_Latin1_General_CP1_CI_AI + '%'
ORDER BY r.recipeId;


-- UserViewRecipe
INSERT INTO UsersViewRecipesHistory (userId, recipeId) VALUES (1, 1);

-- Top Trending
SELECT TOP 10
    r.recipeId,
    r.recipeName,
    r.image,
    r.likeQuantity,
    COUNT(uvr.recipeId) AS viewCount
FROM Recipes r
LEFT JOIN UsersViewRecipesHistory uvr ON r.recipeId = uvr.recipeId
GROUP BY r.recipeId, r.recipeName, r.image, r.likeQuantity
ORDER BY viewCount DESC;

-- Lấy lịch sử xem công thức
SELECT * FROM UsersViewRecipesHistory WHERE UserId = 1


-- Lấy toàn bộ công thức
SELECT 
    r.recipeId,
    r.recipeName,
    r.image,
    r.likeQuantity
FROM Recipes r;

SELECT 
    cs.recipeId,
    cs.indexStep,
    cs.content AS stepContent
FROM CookingSteps cs
ORDER BY cs.recipeId, cs.indexStep;

SELECT 
    ri.recipeId,
    i.ingredientId,
    i.ingredientName,
    ri.weight,
    ri.unit
FROM RecipesIngredients ri
JOIN Ingredients i ON ri.ingredientId = i.ingredientId
ORDER BY ri.recipeId;

-- Kiểm tra thông tin bảng
SELECT * FROM Users;
SELECT * FROM Recipes;
SELECT * FROM Ingredients;
SELECT * FROM RecipesIngredients;
SELECT * FROM CookingSteps;
SELECT * FROM UsersViewRecipesHistory;

DROP TABLE UsersViewRecipesHistory
DROP TABLE CookingSteps
DROP TABLE RecipesIngredients
DROP TABLE Ingredients
DROP TABLE UsersLike
DROP TABLE UsersComment
DROP TABLE Recipes
