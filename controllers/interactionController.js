const express = require('express');
const interactionModel = require('../models/interactionModel');

exports.likeRecipe = async (req, res) => {
    const { userId, recipeId } = req.body;

    if (!userId || !recipeId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const result = await interactionModel.likeRecipe(userId, recipeId);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.addComment = async (req, res) => {
    console.log('req.body:', req.body);

    if (!req.body) {
        return res.status(400).json({ error: 'Request body is missing' });
    }

    const { userId, recipeId, content } = req.body;

    if (!userId || typeof userId !== 'number' || userId <= 0) {
        return res.status(400).json({ error: 'userId is required and must be a positive number' });
    }
    if (!recipeId || typeof recipeId !== 'number' || recipeId <= 0) {
        return res.status(400).json({ error: 'recipeId is required and must be a positive number' });
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: 'content is required and must be a non-empty string' });
    }
    if (content.length > 1500) {
        return res.status(400).json({ error: 'content must not exceed 1500 characters' });
    }

    try {
        const result = await interactionModel.addComment(userId, recipeId, content);
        return res.status(201).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};

exports.increaseViewCount = async (req, res) => {
    const { recipeId } = req.body;

    if (!recipeId || typeof recipeId !== 'number' || recipeId <= 0) {
        return res.status(400).json({ error: 'recipeId is required and must be a positive number' });
    }

    try {
        const result = await interactionModel.increaseViewCount(recipeId);
        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
