CREATE DATABASE ChefMateDB;

CREATE TABLE Users(
  userId INT PRIMARY KEY IDENTITY(1,1),
  fullName NVARCHAR(100) NOT NULL,
  phone NVARCHAR(10) NOT NULL UNIQUE,
  email NVARCHAR(50) UNIQUE,
  passwordHash NVARCHAR(255) NOT NULL,
  followCount INT NOT NULL DEFAULT 0,
  recipeCount INT NOT NULL DEFAULT 0,
  createdAt DATETIME DEFAULT GETDATE()
);

CREATE TABLE Recipes(
  recipeId INT PRIMARY KEY IDENTITY(1,1),
  recipeName NVARCHAR(100) NOT NULL,
  image NVARCHAR(1000) NOT NULL,
  likeQuantity INT DEFAULT 0,
  cookingTime NVARCHAR(20) NOT NULL,
  ration INT NOT NULL,
  viewCount INT NOT NULL DEFAULT 0,
  userId INT FOREIGN KEY REFERENCES Users(userId),
  createdAt DATETIME DEFAULT GETDATE()
);

CREATE TABLE Tags(
  tagId INT PRIMARY KEY IDENTITY(1,1),
  tagName NVARCHAR(100) NOT NULL
);

CREATE TABLE RecipesTags(
  rtId INT PRIMARY KEY IDENTITY(1,1),
  recipeId INT FOREIGN KEY REFERENCES Recipes(recipeId),
  tagId INT FOREIGN KEY REFERENCES Tags(tagId)
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


-- Kiểm tra thông tin bảng
SELECT * FROM Users;
SELECT * FROM Recipes;
SELECT * FROM Ingredients;
SELECT * FROM RecipesIngredients;
SELECT * FROM CookingSteps;

DROP DATABASE ChefMateDB;

DROP TABLE UsersComment;
DROP TABLE UsersLike;
DROP TABLE CookingSteps;
DROP TABLE RecipesIngredients;
DROP TABLE Ingredients;
DROP TABLE Recipes;
DROP TABLE Users;