const { pool } = require('../../config/dbConfig');

async function setupTestDatabase() {
    const conn = await pool.getConnection();
    try {
        // Create test tables if not exist
        await conn.query(`
            CREATE TABLE IF NOT EXISTS Pantries (
                pantryId INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL,
                ownerUserId INT NOT NULL,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_pantries_owner (ownerUserId)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS PantryShares (
                pantryId INT NOT NULL,
                userId INT NOT NULL,
                role ENUM('viewer', 'editor') NOT NULL DEFAULT 'viewer',
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (pantryId, userId),
                INDEX idx_pantryshares_user (userId),
                INDEX idx_pantryshares_pantry (pantryId)
            )
        `);
    } finally {
        conn.release();
    }
}

async function cleanupTestDatabase() {
    const conn = await pool.getConnection();
    try {
        await conn.query('DELETE FROM PantryShares');
        await conn.query('DELETE FROM PantryItems');
        await conn.query('DELETE FROM Pantries');
        await conn.query('ALTER TABLE Pantries AUTO_INCREMENT = 1');
        await conn.query('ALTER TABLE PantryShares AUTO_INCREMENT = 1');
    } finally {
        conn.release();
    }
}

module.exports = {
    setupTestDatabase,
    cleanupTestDatabase
};