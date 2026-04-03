const express = require('express');
const interactionModel = require('../models/interactionModel');

exports.likeRecipe = async (req, res) => {
    const { recipeId } = req.body || {};
    const parsedUserId = Number(req.auth?.userId || req.userId || req.body?.userId || 0);
    const parsedRecipeId = Number(recipeId);

    if (!parsedUserId || parsedUserId <= 0 || !parsedRecipeId || parsedRecipeId <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId and recipeId are required and must be positive numbers'
        });
    }

    try {
        const result = await interactionModel.likeRecipe(parsedUserId, parsedRecipeId);

        if (!result.success && result.message === 'Recipe not found') {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            data: null,
            message: 'Internal Server Error'
        });
    }
};

exports.addComment = async (req, res) => {
    console.log('req.body:', req.body);

    if (!req.body) {
        return res.status(400).json({ error: 'Request body is missing' });
    }

    const { recipeId, content } = req.body;
    const userId = Number(req.auth?.userId || req.userId || req.body?.userId || 0);

    if (!userId || userId <= 0) {
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

exports.getAllComments = async (req, res) => {
    try {
        const result = await interactionModel.getAllComments();
        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to get comments: ${error.message}`
        });
    }
};

exports.deleteComment = async (req, res) => {
    const commentId = Number(req.body?.commentId || req.query?.commentId || 0);
    const userId = Number(req.auth?.userId || req.userId || req.body?.userId || 0) || null;

    if (!commentId) {
        return res.status(400).json({ error: 'commentId is required' });
    }

    try {
        const result = await interactionModel.deleteComment(commentId, userId);
        if (!result.success) {
            return res.status(404).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to delete comment: ${error.message}`
        });
    }
};
