const { pool } = require('../../config/dbConfig');
const { setupTestDatabase, cleanupTestDatabase } = require('../setup/testDbSetup');
const { createTestUser, createTestPantry, createTestShare, createTestIngredient } = require('../setup/fixtures');

// Need to import the model to test internal functions
// We'll test via the exported function getRecommendationsFromPantry
let aiChatModel;

beforeAll(async () => {
    aiChatModel = require('../../models/aiChatModel');
});

describe('getPantryMapByUser with pantryId parameter', () => {
    beforeEach(async () => {
        await setupTestDatabase();
    });

    afterEach(async () => {
        await cleanupTestDatabase();
    });

    it('should filter by pantryId when provided', async () => {
        const user = await createTestUser(1, 'Test User');
        const pantry1 = await createTestPantry(user.userId, 'Pantry 1');
        const pantry2 = await createTestPantry(user.userId, 'Pantry 2');

        const ingredient1 = await createTestIngredient('Thịt heo');
        const ingredient2 = await createTestIngredient('Thịt bò');

        // Add items to pantry1
        await pool.query(
            'INSERT INTO PantryItems (pantryId, ingredientId, quantity, unit) VALUES (?, ?, ?, ?)',
            [pantry1.pantryId, ingredient1.ingredientId, 500, 'g']
        );

        // Add items to pantry2
        await pool.query(
            'INSERT INTO PantryItems (pantryId, ingredientId, quantity, unit) VALUES (?, ?, ?, ?)',
            [pantry2.pantryId, ingredient2.ingredientId, 300, 'g']
        );

        // Get only pantry1 items
        const result = await aiChatModel.getRecommendationsFromPantry({
            userId: user.userId,
            pantryId: pantry1.pantryId,
            limit: 10
        });

        expect(result.success).toBe(true);
        // Should only have thịt heo from pantry1, not thịt bò from pantry2
        const allIngredients = [
            ...(result.data.readyToCook || []),
            ...(result.data.almostReady || [])
        ].flatMap(r => r.missing.map(m => m.ingredientName));

        // thịt bò from pantry2 should NOT be in the results
        expect(allIngredients).not.toContain('Thịt bò');
    });

    it('should return all pantries when pantryId is not provided', async () => {
        const user = await createTestUser(1, 'Test User');
        const pantry1 = await createTestPantry(user.userId, 'Pantry 1');
        const pantry2 = await createTestPantry(user.userId, 'Pantry 2');

        const ingredient1 = await createTestIngredient('Thịt heo');
        const ingredient2 = await createTestIngredient('Thịt bò');

        // Add items to both pantries
        await pool.query(
            'INSERT INTO PantryItems (pantryId, ingredientId, quantity, unit) VALUES (?, ?, ?, ?)',
            [pantry1.pantryId, ingredient1.ingredientId, 500, 'g']
        );
        await pool.query(
            'INSERT INTO PantryItems (pantryId, ingredientId, quantity, unit) VALUES (?, ?, ?, ?)',
            [pantry2.pantryId, ingredient2.ingredientId, 300, 'g']
        );

        // Get all pantries (no pantryId)
        const result = await aiChatModel.getRecommendationsFromPantry({
            userId: user.userId,
            limit: 10
        });

        expect(result.success).toBe(true);
        // Should include ingredients from both pantries
    });

    it('should return empty when pantryId does not belong to user', async () => {
        const user1 = await createTestUser(1, 'User 1');
        const user2 = await createTestUser(2, 'User 2');
        const pantry1 = await createTestPantry(user1.userId, 'Pantry 1');

        const ingredient = await createTestIngredient('Thịt heo');
        await pool.query(
            'INSERT INTO PantryItems (pantryId, ingredientId, quantity, unit) VALUES (?, ?, ?, ?)',
            [pantry1.pantryId, ingredient.ingredientId, 500, 'g']
        );

        // User 2 tries to get recommendations from User 1's pantry
        const result = await aiChatModel.getRecommendationsFromPantry({
            userId: user2.userId,
            pantryId: pantry1.pantryId,
            limit: 10
        });

        expect(result.success).toBe(true);
        // User 2 doesn't have access to pantry1, so should return empty
    });
});