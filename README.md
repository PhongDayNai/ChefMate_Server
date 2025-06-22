# Hệ thống ứng dụng công thức nấu ăn - ChefMate

# II. Server - Máy chủ

- Công nghệ: ExpressJS
- Cơ sở dữ liệu: SQL Server

## 1. Tính năng

| User | Recipe | Interaction |
| --- | --- | --- |
| Đăng nhập | Lấy công thức nấu ăn xác định | Yêu thích công thức nấu ăn |
| Đăng ký | Tìm kiếm công thức theo tên | Bình luận công thức nấu ăn |
| Đổi mật khẩu | Tìm kiếm công thức theo tag |  |
| Chỉnh sửa thông tin cá nhân | Tạo công thức nấu ăn mới |  |
| Lấy toàn bộ người dùng | Lịch sử xem công thức nấu ăn |  |
|  | Lấy danh sách công thức Top Trending |  |
|  | Lấy danh sách nguyên liệu sẵn có |  |
|  | Lấy danh sách tag sẵn có |  |

### User

- [x]  Đăng nhập
- [x]  Đăng ký
- [x]  Đổi mật khẩu
- [x]  Chỉnh sửa thông tin cá nhân
- [x]  Lấy toàn bộ người dùng

### b. Recipe

- [x]  Lấy toàn bộ công thức nấu ăn
- [x]  Lấy công thức nấu ăn xác định
- [x]  Tìm kiếm công thức theo tên
- [x]  Tìm kiếm công thức theo tag
- [x]  Tạo công thức nấu ăn mới
- [x]  Lấy danh sách công thức Top Trending
- [x]  Lấy danh sách nguyên liệu sẵn có
- [x]  Lấy danh sách tag sẵn có
- [x]  Lịch sử xem công thức nấu ăn

### c. Interaction

- [x]  Yêu thích công thức nấu ăn
- [x]  Bình luận công thức nấu ăn

## 2. Cơ sở dữ liệu

```sql
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

CREATE TABLE UsersViewRecipesHistory(
  uvrId INT PRIMARY KEY IDENTITY(1, 1),
  userId INT FOREIGN KEY REFERENCES Users(userId),
  recipeId INT FOREIGN KEY REFERENCES Recipes(recipeId),
  createdAt DATETIME DEFAULT GETDATE()
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
```
