const pantryModel = require('../../models/pantryModel');
const { setupTestDatabase, cleanupTestDatabase } = require('../setup/testDbSetup');
const { createTestUser, createTestPantry, createTestShare, createTestIngredient } = require('../setup/fixtures');

describe('Pantry Model - getUserPantryAccess', () => {
    beforeEach(async () => {
        await setupTestDatabase();
    });

    afterEach(async () => {
        await cleanupTestDatabase();
    });

    it('should return "owner" for pantry owner', async () => {
        const user = await createTestUser(1, 'Owner User');
        const pantry = await createTestPantry(user.userId, 'My Pantry');

        const access = await pantryModel.getUserPantryAccess(pantry.pantryId, user.userId);
        expect(access).toBe('owner');
    });

    it('should return "editor" for shared user with editor role', async () => {
        const owner = await createTestUser(1, 'Owner User');
        const editor = await createTestUser(2, 'Editor User');
        const pantry = await createTestPantry(owner.userId, 'My Pantry');
        await createTestShare(pantry.pantryId, editor.userId, 'editor');

        const access = await pantryModel.getUserPantryAccess(pantry.pantryId, editor.userId);
        expect(access).toBe('editor');
    });

    it('should return "viewer" for shared user with viewer role', async () => {
        const owner = await createTestUser(1, 'Owner User');
        const viewer = await createTestUser(2, 'Viewer User');
        const pantry = await createTestPantry(owner.userId, 'My Pantry');
        await createTestShare(pantry.pantryId, viewer.userId, 'viewer');

        const access = await pantryModel.getUserPantryAccess(pantry.pantryId, viewer.userId);
        expect(access).toBe('viewer');
    });

    it('should return null for user with no access', async () => {
        const owner = await createTestUser(1, 'Owner User');
        const stranger = await createTestUser(3, 'Stranger User');
        const pantry = await createTestPantry(owner.userId, 'My Pantry');

        const access = await pantryModel.getUserPantryAccess(pantry.pantryId, stranger.userId);
        expect(access).toBeNull();
    });
});

describe('Pantry Model - getOrCreateDefaultPantryId', () => {
    beforeEach(async () => {
        await setupTestDatabase();
    });

    afterEach(async () => {
        await cleanupTestDatabase();
    });

    it('should create new pantry if not exists', async () => {
        const user = await createTestUser(1, 'User');

        const pantryId = await pantryModel.getOrCreateDefaultPantryId(user.userId);

        expect(pantryId).toBeGreaterThan(0);
    });

    it('should return existing default pantry', async () => {
        const user = await createTestUser(1, 'User');
        const existingPantry = await createTestPantry(user.userId, 'My Pantry');

        const pantryId = await pantryModel.getOrCreateDefaultPantryId(user.userId);

        expect(pantryId).toBe(existingPantry.pantryId);
    });
});

describe('Pantry Model - listPantriesByUser', () => {
    beforeEach(async () => {
        await setupTestDatabase();
    });

    afterEach(async () => {
        await cleanupTestDatabase();
    });

    it('should list owned and shared pantries', async () => {
        const user1 = await createTestUser(1, 'User One');
        const user2 = await createTestUser(2, 'User Two');

        const pantry1 = await createTestPantry(user1.userId, 'User1 Pantry');
        const pantry2 = await createTestPantry(user1.userId, 'User1 Pantry 2');
        const pantry3 = await createTestPantry(user2.userId, 'Shared Pantry');

        await createTestShare(pantry3.pantryId, user1.userId, 'editor');

        const result = await pantryModel.listPantriesByUser(user1.userId);

        expect(result.success).toBe(true);
        expect(result.data.length).toBeGreaterThanOrEqual(3);
        const pantryIds = result.data.map(p => p.pantryId);
        expect(pantryIds).toContain(pantry1.pantryId);
        expect(pantryIds).toContain(pantry2.pantryId);
        expect(pantryIds).toContain(pantry3.pantryId);
    });

    it('should return empty list for user with no pantries', async () => {
        const user = await createTestUser(1, 'Lone User');

        const result = await pantryModel.listPantriesByUser(user.userId);

        expect(result.success).toBe(true);
        expect(result.data.length).toBe(0);
    });
});

describe('Pantry Model - sharePantry', () => {
    beforeEach(async () => {
        await setupTestDatabase();
    });

    afterEach(async () => {
        await cleanupTestDatabase();
    });

    it('should allow owner to share pantry with editor role', async () => {
        const owner = await createTestUser(1, 'Owner User');
        const target = await createTestUser(2, 'Target User');
        const pantry = await createTestPantry(owner.userId, 'My Pantry');

        const result = await pantryModel.sharePantry({
            pantryId: pantry.pantryId,
            ownerUserId: owner.userId,
            targetUserId: target.userId,
            role: 'editor'
        });

        expect(result.success).toBe(true);
    });

    it('should reject share to self', async () => {
        const owner = await createTestUser(1, 'Owner User');
        const pantry = await createTestPantry(owner.userId, 'My Pantry');

        await expect(
            pantryModel.sharePantry({
                pantryId: pantry.pantryId,
                ownerUserId: owner.userId,
                targetUserId: owner.userId,
                role: 'editor'
            })
        ).rejects.toThrow('Cannot share pantry with yourself');
    });

    it('should deny non-owner from sharing', async () => {
        const owner = await createTestUser(1, 'Owner User');
        const editor = await createTestUser(2, 'Editor User');
        const target = await createTestUser(3, 'Target User');
        const pantry = await createTestPantry(owner.userId, 'My Pantry');
        await createTestShare(pantry.pantryId, editor.userId, 'editor');

        await expect(
            pantryModel.sharePantry({
                pantryId: pantry.pantryId,
                ownerUserId: editor.userId,
                targetUserId: target.userId,
                role: 'viewer'
            })
        ).rejects.toThrow('Only owner can share pantry');
    });
});

describe('Pantry Model - deletePantry', () => {
    beforeEach(async () => {
        await setupTestDatabase();
    });

    afterEach(async () => {
        await cleanupTestDatabase();
    });

    it('should allow owner to delete pantry', async () => {
        const user = await createTestUser(1, 'Owner User');
        const pantry = await createTestPantry(user.userId, 'My Pantry');

        const result = await pantryModel.deletePantry({
            pantryId: pantry.pantryId,
            userId: user.userId
        });

        expect(result.success).toBe(true);
    });

    it('should deny non-owner from deleting pantry', async () => {
        const owner = await createTestUser(1, 'Owner User');
        const editor = await createTestUser(2, 'Editor User');
        const pantry = await createTestPantry(owner.userId, 'My Pantry');
        await createTestShare(pantry.pantryId, editor.userId, 'editor');

        await expect(
            pantryModel.deletePantry({
                pantryId: pantry.pantryId,
                userId: editor.userId
            })
        ).rejects.toThrow('Only owner can delete pantry');
    });
});

describe('Pantry Model - upsertPantryItem (with access control)', () => {
    beforeEach(async () => {
        await setupTestDatabase();
    });

    afterEach(async () => {
        await cleanupTestDatabase();
    });

    it('should allow owner to add item', async () => {
        const user = await createTestUser(1, 'Owner User');
        const pantry = await createTestPantry(user.userId, 'My Pantry');

        const result = await pantryModel.upsertPantryItem({
            pantryId: pantry.pantryId,
            userId: user.userId,
            ingredientName: 'Tomato',
            quantity: 5,
            unit: 'pcs'
        });

        expect(result.success).toBe(true);
        expect(result.data.length).toBeGreaterThan(0);
    });

    it('should allow editor to add item', async () => {
        const owner = await createTestUser(1, 'Owner User');
        const editor = await createTestUser(2, 'Editor User');
        const pantry = await createTestPantry(owner.userId, 'My Pantry');
        await createTestShare(pantry.pantryId, editor.userId, 'editor');

        const result = await pantryModel.upsertPantryItem({
            pantryId: pantry.pantryId,
            userId: editor.userId,
            ingredientName: 'Onion',
            quantity: 3,
            unit: 'pcs'
        });

        expect(result.success).toBe(true);
    });

    it('should deny viewer from adding item', async () => {
        const owner = await createTestUser(1, 'Owner User');
        const viewer = await createTestUser(2, 'Viewer User');
        const pantry = await createTestPantry(owner.userId, 'My Pantry');
        await createTestShare(pantry.pantryId, viewer.userId, 'viewer');

        await expect(
            pantryModel.upsertPantryItem({
                pantryId: pantry.pantryId,
                userId: viewer.userId,
                ingredientName: 'Garlic',
                quantity: 10,
                unit: 'pcs'
            })
        ).rejects.toThrow('Edit access denied');
    });
});

describe('Pantry Model - updatePantryShareRole', () => {
    beforeEach(async () => {
        await setupTestDatabase();
    });

    afterEach(async () => {
        await cleanupTestDatabase();
    });

    it('should allow owner to update share role', async () => {
        const owner = await createTestUser(1, 'Owner User');
        const target = await createTestUser(2, 'Target User');
        const pantry = await createTestPantry(owner.userId, 'My Pantry');
        await createTestShare(pantry.pantryId, target.userId, 'viewer');

        const result = await pantryModel.updatePantryShareRole({
            pantryId: pantry.pantryId,
            ownerUserId: owner.userId,
            targetUserId: target.userId,
            role: 'editor'
        });

        expect(result.success).toBe(true);
    });

    it('should reject invalid role', async () => {
        const owner = await createTestUser(1, 'Owner User');
        const target = await createTestUser(2, 'Target User');
        const pantry = await createTestPantry(owner.userId, 'My Pantry');

        await expect(
            pantryModel.updatePantryShareRole({
                pantryId: pantry.pantryId,
                ownerUserId: owner.userId,
                targetUserId: target.userId,
                role: 'admin'  // invalid
            })
        ).rejects.toThrow('Invalid role');
    });
});