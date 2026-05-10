const { pool } = require('../../config/dbConfig');

async function createTestUser(userId = 1, fullName = 'Test User', phone = '0123456789') {
    const [result] = await pool.query(
        'INSERT INTO Users (userId, fullName, phone, passwordHash) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE fullName = ?',
        [userId, fullName, phone, 'hash_' + userId, fullName]
    );
    return { userId: Number(userId), fullName, phone };
}

async function createTestPantry(ownerUserId = 1, name = 'Test Pantry') {
    const [result] = await pool.query(
        'INSERT INTO Pantries (name, ownerUserId) VALUES (?, ?)',
        [name, ownerUserId]
    );
    return { pantryId: Number(result.insertId), name, ownerUserId };
}

async function createTestShare(pantryId, userId, role = 'viewer') {
    await pool.query(
        'INSERT INTO PantryShares (pantryId, userId, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = ?',
        [pantryId, userId, role, role]
    );
}

async function createTestIngredient(ingredientName = 'Test Ingredient') {
    const [result] = await pool.query(
        'INSERT INTO Ingredients (ingredientName) VALUES (?) ON DUPLICATE KEY UPDATE ingredientName = ?',
        [ingredientName, ingredientName]
    );
    return { ingredientId: Number(result.insertId), ingredientName };
}

module.exports = {
    createTestUser,
    createTestPantry,
    createTestShare,
    createTestIngredient
};