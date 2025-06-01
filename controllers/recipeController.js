const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');
const recipeModel = require('../models/recipeModel');
const path = require('path');

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
    const { recipeName, ingredients, cookingSteps } = req.body;

    if (!recipeName || !ingredients || !cookingSteps) {
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

    const { recipeName } = req.body;

    if (!recipeName || typeof recipeName !== 'string') {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const result = await recipeModel.searchRecipe(recipeName);
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

    const { recipeId } = req.body;

    try {
        const result = await recipeModel.getDirectRecipe(recipeId);
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
}