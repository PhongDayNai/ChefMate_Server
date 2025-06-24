const express = require('express');
const recipeModel = require('../models/recipeModel');

exports.getAllRecipes = async (req, res) => {
    try {
        const result = await recipeModel.getAllRecipes();
        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to get recipes: ${error.message}`
        });
    }
};

exports.createRecipe = async (req, res) => {
    console.log('req.file:', req.file);
    const { recipeName, cookingTime, ration, ingredients, cookingSteps, userId, tags } = req.body;

    if (!recipeName || !cookingTime || !ration || !ingredients || !cookingSteps || !userId) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'All fields (recipeName, cookingTime, ration, ingredients, cookingSteps, userId) are required'
        });
    }

    try {
        const parsedIngredientsRaw = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients;
        const parsedCookingSteps = typeof cookingSteps === 'string' ? JSON.parse(cookingSteps) : cookingSteps;
        const parsedTags = tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : [];

        const parsedIngredients = parsedIngredientsRaw.map(ing => ({
            ...ing,
            ingredientName: normalizeText(ing.ingredientName),
            unit: normalizeText(ing.unit)
        }));

        const normalizedTags = parsedTags.map(tag => ({
            tagName: normalizeText(tag.tagName)
        }));

        if (!req.file) {
            return res.status(400).json({
                success: false,
                data: null,
                message: 'Image is required'
            });
        }

        if (!Array.isArray(parsedIngredients) || parsedIngredients.length === 0) {
            return res.status(400).json({
                success: false,
                data: null,
                message: 'Ingredients must be a non-empty array'
            });
        }
        if (!Array.isArray(parsedCookingSteps) || parsedCookingSteps.length === 0) {
            return res.status(400).json({
                success: false,
                data: null,
                message: 'Cooking steps must be a non-empty array'
            });
        }
        if (!Array.isArray(parsedTags)) {
            return res.status(400).json({
                success: false,
                data: null,
                message: 'Tags must be an array'
            });
        }
        // if (typeof userId !== 'number' || userId <= 0) {
        //     console.log('userId:', userId);
        //     return res.status(400).json({
        //         success: false,
        //         data: null,
        //         message: 'userId must be a positive number'
        //     });
        // }
        const parsedUserId = parseInt(userId, 10);
        if (isNaN(parsedUserId) || parsedUserId <= 0) {
            console.log('Invalid userId:', userId, 'typeof:', typeof userId);
            return res.status(400).json({
                success: false,
                data: null,
                message: 'userId must be a positive number'
            });
        }

        console.log('parsedIngredients:', parsedIngredients);
        console.log('parsedCookingSteps:', parsedCookingSteps);

        const imagePath = `/images/${req.file.filename}`;

        const newRecipe = await recipeModel.createRecipe(
            recipeName,
            imagePath,
            cookingTime,
            ration,
            parsedIngredients,
            parsedCookingSteps,
            userId,
            normalizedTags
        );

        res.status(201).json(newRecipe);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to create recipe: ${error.message}`
        });
    }
};

exports.searchRecipe = async (req, res) => {
    if (!req.body) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'Request body is missing'
        });
    }

    const { recipeName, userId } = req.body;

    if (!recipeName || typeof recipeName !== 'string') {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'recipeName is required and must be a string'
        });
    }

    if (userId && (typeof userId !== 'number' || userId <= 0)) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId must be a positive number if provided'
        });
    }

    try {
        const result = await recipeModel.searchRecipe(recipeName, userId);
        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to search recipes: ${error.message}`
        });
    }
};

exports.getAllIngredients = async (req, res) => {
    try {
        const result = await recipeModel.getAllIngredients();
        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to get ingredients: ${error.message}`
        });
    }
};

exports.getTopTrending = async (req, res) => {
    const { userId } = req.body;

    try {
        const result = await recipeModel.getTopTrending(userId || null);
        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to get trending recipes: ${error.message}`
        });
    }
};

exports.getAllTags = async (req, res) => {
    try {
        const result = await recipeModel.getAllTags();
        return res.status(200).json(result);
    } catch (error) {
        console.error("Error in getAllTags controller:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to get tags: ${error.message}`
        });
    }
};

exports.searchRecipesByTag = async (req, res) => {
    console.log('req.body:', req.body);

    if (!req.body) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'Request body is missing'
        });
    }

    const { tagName, userId } = req.body;

    if (!tagName || typeof tagName !== 'string') {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'tagName is required and must be a string'
        });
    }

    if (userId && (typeof userId !== 'number' || userId <= 0)) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId must be a positive number if provided'
        });
    }

    try {
        const result = await recipeModel.searchRecipesByTag(normalizeText(tagName), userId);
        return res.status(200).json(result);
    } catch (error) {
        console.error("Error in searchRecipesByTag controller:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to search recipes by tag: ${error.message}`
        });
    }
};

exports.getRecipesByUserId = async (req, res) => {
    const { userId } = req.body;

    if (!userId || typeof userId !== 'number' || userId <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId is required and must be a positive number'
        });
    }

    try {
        const result = await recipeModel.getRecipesByUserId(userId);
        return res.status(200).json(result);
    } catch (error) {
        console.error("Error in getRecipesByUserId controller:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to get recipes: ${error.message}`
        });
    }
};

exports.getRecipeGrowthByMonth = async (req, res) => {
    try {
        const result = await recipeModel.getRecipeGrowthByMonth();
        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to get recipe growth report: ${error.message}`
        });
    }
};

function normalizeText(str) {
    return str
        .toLowerCase()
        .split(' ')
        .filter(word => word)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};
