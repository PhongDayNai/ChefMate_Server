const express = require('express');
const recipeModel = require('../models/recipeModel');

exports.getAllRecipes = async (req, res) => {
    try {
        const result = await recipeModel.getAllRecipes();
        return res.status(200).json({ result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.createRecipe = async (req, res) => {
    console.log('req.file:', req.file);
    const { recipeName, ingredients, cookingSteps, userId } = req.body;

    if (!recipeName || !ingredients || !cookingSteps || !userId) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const parsedIngredients = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients;
        const parsedCookingSteps = typeof cookingSteps === 'string' ? JSON.parse(cookingSteps) : cookingSteps;

        if (!req.file) {
            return res.status(400).json({ error: 'Image is required' });
        }

        console.log('req.file:', req.file);
        console.log('req.body:', req.body);
        console.log('parsedIngredients:', parsedIngredients);
        console.log('parsedCookingSteps:', parsedCookingSteps);

        const imagePath = `/images/${req.file.filename}`;

        const newRecipe = await recipeModel.createRecipe(
            recipeName,
            imagePath,
            parsedIngredients,
            parsedCookingSteps,
            userId
        );

        res.status(201).json(newRecipe);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.searchRecipe = async (req, res) => {
    console.log('req.body:', req.body);

    if (!req.body) {
        return res.status(400).json({ error: 'Request body is missing' });
    }

    const { recipeName, userId } = req.body;

    if (!recipeName || typeof recipeName !== 'string') {
        return res.status(400).json({ error: 'recipeName is required and must be a string' });
    }

    if (userId && (typeof userId !== 'number' || userId <= 0)) {
        return res.status(400).json({ error: 'userId must be a positive number if provided' });
    }

    try {
        const result = await recipeModel.searchRecipe(recipeName, userId);
        return res.status(200).json({ result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.getDirectRecipe = async (req, res) => {
    console.log('req.body:', req.body);

    if (!req.body) {
        return res.status(400).json({ error: 'Request body is missing' });
    }

    const { recipeId, userId } = req.body;

    if (!recipeId || typeof recipeId !== 'number' || recipeId <= 0) {
        return res.status(400).json({ error: 'recipeId is required and must be a positive number' });
    }

    if (userId && (typeof userId !== 'number' || userId <= 0)) {
        return res.status(400).json({ error: 'userId must be a positive number if provided' });
    }

    try {
        const result = await recipeModel.getDirectRecipe(recipeId, userId);
        return res.status(200).json({ result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.getAllIngredients = async (req, res) => {
    try {
        const result = await recipeModel.getAllIngredients();
        return res.status(200).json({ result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.getTopTrending = async (req, res) => {
    try {
        const result = await recipeModel.getTopTrending();
        return res.status(200).json({ result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};