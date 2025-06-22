const userModel = require('../models/userModel');
const bcrypt = require('bcrypt');

exports.getAllUsers = async (req, res) => {
    try {
        const users = await userModel.getAllUsers();
        console.log("Users: ", users);
        return res.status(200).json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        return res.status(500).json({ error: error.message });
    }
};

exports.createUser = async (req, res) => {
    const { phone, email, password, fullName } = req.body;

    try {
        const existingUser = await userModel.getUserByPhone(phone);
        console.log('Existing User:', existingUser);

        if (existingUser) {
            return res.status(400).json({ error: 'Phone number is in use' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const newUser = await userModel.createUser(fullName, phone, email, passwordHash);
        console.log('New User:', newUser);

        const user = await userModel.getUserByPhone(phone);
        console.log('User:', user);

        res.status(201).json({
            success: true,
            data: user,
            message: 'User created successfully'
        });
    } catch (error) {
        console.log('Error:', error);
        res.status(500).json({ error: 'Error creating user' });
    }
};

exports.login = async (req, res) => {
    const { phone, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ error: 'Phone number and password are required' });
    }
    
    try {
        const user = await userModel.getUserByPhone(phone)

        if (!user) {
            return res.status(401).json({ error: 'Phone number is not existed' });
        }

        console.log('User:', user);
        const isMatch = await bcrypt.compare(password, user.PasswordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Password is incorrect' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'There was an error logging in' });
    }
};

exports.resetPassword = async (req, res) => {
    const { phone } = req.body;

    try {
        let existingUser = await userModel.getUserByPhone(phone);

        if (!user) {
            return res.status(401).json({ error: 'Phone number is not existed' });
        }

        const passwordHash = await bcrypt.hash("1", 10);
        const rsUser = await userModel.resetPassword(phone, passwordHash);
        user = await userModel.getUserByPhone(phone);

        console.log("User: ", user);
        return res.status(201).json(user);
    } catch (error) {
        console.log("error: ", error);
        return res.status(500).json({ error: 'There was an error resetting password' });
    }
};

exports.changePassword = async (req, res) => {
    const { phone, newPassword } = req.body;

    try {
        let existingUser = await userModel.getUserByPhone(phone);

        if (!user) {
            return res.status(401).json({ error: 'Phone number is not existed' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        const rsUser = await userModel.resetPassword(phone, passwordHash);
        user = await userModel.getUserByPhone(phone);

        console.log("User: ", user);
        return res.status(201).json(user);
    } catch (error) {
        console.log("error: ", error);
        return res.status(500).json({ error: 'There was an error changing password' });
    }
};

exports.updateUserInformation = async (req, res) => {
    const { userId, fullName, phone } = req.body;

    try {
        const rsUser = await userModel.updateUserInforamtion(userId, fullName, phone);
        return res.status(200).json(rsUser);
    } catch (error) {
        console.log("error: ", error);
        return res.status(500).json({ error: 'There was an error updating user information' });
    }
};

exports.getRecipesViewHistory = async (req, res) => {
    const { userId } = req.body;

    try {
        const recipesViewHistory = await userModel.getRecipesViewHistory(userId);
        return res.status(200).json(recipesViewHistory);
    } catch (error) {
        console.error("error: ", error);
        return res.status(400).json({ error: error.message });
    }
};
