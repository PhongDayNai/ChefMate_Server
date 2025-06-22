# Hệ thống ứng dụng công thức nấu ăn - ChefMate

# II. Server - Máy chủ

- Công nghệ: ExpressJS
- Cơ sở dữ liệu: SQL Server

## 1. Tính năng

| User | Recipe | Interaction |
| --- | --- | --- |
| Đăng nhập bằng số điện thoại hoặc email | Tìm kiếm công thức theo tên | Yêu thích công thức nấu ăn |
| Đăng ký | Tìm kiếm công thức theo tag | Bình luận công thức nấu ăn |
| Đổi mật khẩu | Tạo công thức nấu ăn mới |  |
| Chỉnh sửa thông tin cá nhân | Lịch sử xem công thức nấu ăn |  |
| Lấy toàn bộ người dùng | Lấy danh sách công thức Top Trending |  |
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

## 3. Cách thực hiện

- Khởi động SQL server
    - Nếu bạn sử dụng Windows:
        - Hãy mở lên bằng cách nhấn tổ hợp phím Windows + R
        - Sau đó nhập …
    - Nếu bạn sử dụng Linux (Distro Ubuntu):
        
        ```bash
        sudo systemctl start mssql-server
        ```
        
- Khởi động ExpressJS server

```bash
node server.js
```

> Ở bước này nếu trong terminal hiện dòng chữ “Server đang chạy tại [http://localhost:8080](http://localhost:8080/)” và “Đã kết nối SQL Server” là server đã chạy thành công tại localhost
> 
- Khởi động localtunnel chạy trên port bạn chọn

```bash
lt --port 8080
```

> Sau khi chạy lệnh này và có được trả về 1 đường dẫn thì là server đã được deploy tạm thời với đường link đó.
> 

<aside>
💡

Tips: Nếu thực hiện tải ảnh từ client nhưng không được thì các bạn hãy vào link trong terminal đó, thực hiện lấy mật khẩu và xác thực, vậy là sẽ giải quyết được vấn đề.

</aside>