# ChefMate Recipe Application System

# [I. Client - Mobile App](https://github.com/PhongDayNai/ChefMate_Client)

# II. Server

## 1. Technology

- **ExpressJS**: Framework for building RESTful APIs.
- **SQL Server**: Relational database management system.

## 2. Architecture: MVC API Model

- **Models**:
    - **Function**: Define data structures and interact with the database.
    - **Role**: Keep data handling consistent and independent from client requests.
- **Controllers**:
    - **Function**: Handle HTTP requests (GET, POST, PUT, DELETE), call Models for business logic, and return JSON responses.
    - **Role**: Bridge between client and Model, and format responses properly.
- **Routes**:
    - **Function**: Define API endpoints (URLs) and map them to controller handlers.
    - **Role**: Organize API entry points for scalability and maintainability.
- **Database**: Microsoft SQL Server stores, manages, and retrieves data efficiently, integrated well with the MVC API structure.

## 3. Features

| User | Recipe | Interaction |
| --- | --- | --- |
| Login with phone number or email | Get all recipes | Like recipes |
| Register | Search recipes by name | Comment on recipes |
| Change password | Search recipes by tag | Increase recipe views |
| Edit profile | Create new recipes | Get all comments |
| Get all users | Get public recipe posts by a specific user | Delete comments |
|  | Get Top Trending recipes |  |
|  | Get available ingredients list |  |
|  | Get available tags list |  |

### User

- [x] Login
- [x] Register
- [x] Change password
- [x] Edit profile
- [x] Get all users

### b. Recipe

- [x] Get all recipes
- [x] Search recipes by name
- [x] Search recipes by tag
- [x] Create new recipes
- [x] Get public recipe posts by a specific user
- [x] Get Top Trending recipes
- [x] Get available ingredients list
- [x] Get available tags list

### c. Interaction

- [x] Like recipes
- [x] Comment on recipes
- [x] Increase recipe views
- [x] Get all comments
- [x] Delete comments

### d. Pantry + AI Chat (New)

- [x] User-based pantry (`PantryItems`)
- [x] Pantry-based suggestions: `Ready to cook` + `Missing a little`
- [x] Session-based AI Chat, with per-user history (`ChatSessions`, `ChatMessages`)
- [x] Attach currently cooking recipe (`activeRecipeId`) to keep AI context
- [x] When AI API fails: return fallback `AI_SERVER_BUSY` + busy-server message

#### New APIs

- `GET /api/pantry?userId={id}`
- `POST /api/pantry/upsert`
  - body: `{ userId, ingredientName, quantity, unit, expiresAt? }`
- `DELETE /api/pantry/delete`
  - body: `{ userId, pantryItemId }`
- `POST /api/ai-chat/sessions`
  - body: `{ userId, title?, activeRecipeId? }`
- `GET /api/ai-chat/sessions/:sessionId?userId={id}`
- `PATCH /api/ai-chat/sessions/active-recipe`
  - body: `{ userId, chatSessionId, recipeId|null }`
- `POST /api/ai-chat/recommendations-from-pantry`
  - body: `{ userId, limit? }`
- `POST /api/ai-chat/messages`
  - body: `{ userId, chatSessionId?, message, model?, stream?, activeRecipeId? }`

#### AI Environment Variables

- `AI_CHAT_API_URL=https://your-ai-api-url.com`
- `AI_CHAT_MODEL=gemma3:4b`
- `AI_CHAT_TIMEOUT_MS=20000`

#### Security (required before production)

- Do not commit `.env` files to Git.
- Use `.env.example` as a template and put real secrets in deploy environments.
- For Docker Compose, you must set:
  - `MYSQL_ROOT_PASSWORD`
  - `MYSQL_PASSWORD`
- Rotate any secret that was previously hardcoded or committed (DB password, API key, token...).

#### DB Migration (for existing systems)

Run additional scripts:

```bash
mysql -h <host> -u <user> -p <database> < scripts/migrate_ai_chat.sql
```

## 4. Database

<img width="852" height="540" alt="image" src="https://github.com/user-attachments/assets/3172ba07-46dc-4192-afa2-fb8d799a8ce2" />

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

## 5. How to run

- Start SQL Server
    - If you use Windows:
        - Open Run dialog with `Windows + R`
        - Then type …
    - If you use Linux (Ubuntu distro):
        
        ```bash
        sudo systemctl start mssql-server
        ```
        
- Start ExpressJS server

```bash
node server.js
```

> At this step, if terminal shows “Server running at [http://localhost:8080](http://localhost:8080/)” and “SQL Server connected”, the server is running successfully on localhost.
> 
- Start localtunnel on your selected port

```bash
lt --port 8080
```

> After running this command and getting a URL back, the server is temporarily exposed through that link.
> 

<aside>
💡

Tip: If image upload from client does not work, open that localtunnel URL in browser, complete password verification, then try again.

</aside>

# [III. Client - Admin Web](https://github.com/PhongDayNai/ChefMate_Admin_Web)

---

Vietnamese version: [README-vi.md](./README-vi.md)
