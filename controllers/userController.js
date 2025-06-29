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
    const { identifier, password } = req.body;

    if (!identifier || !password) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'Identifier (email or phone) and password are required'
        });
    }

    try {
        console.log(`Login attempt with identifier: ${identifier}`);
        const user = await userModel.getUserByIdentifier(identifier);

        if (!user) {
            console.log(`No user found with identifier: ${identifier}`);
            return res.status(401).json({
                success: false,
                data: null,
                message: 'Email or phone number does not exist'
            });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            console.log('Password mismatch for identifier:', identifier);
            return res.status(401).json({
                success: false,
                data: null,
                message: 'Password is incorrect'
            });
        }

        const { passwordHash, ...safeUser } = user;
        console.log(`Login successful for user: ${user.userId}`);
        res.status(200).json({
            success: true,
            data: safeUser,
            message: 'Login successfully'
        });
    } catch (error) {
        console.error(`Error during login for identifier ${identifier}:`, error);
        res.status(500).json({
            success: false,
            data: null,
            message: 'There was an error logging in'
        });
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
        return res.status(201).json({
            success: true,
            data: user,
            message: 'Reset password successfully'
        });
    } catch (error) {
        console.log("error: ", error);
        return res.status(500).json({ error: 'There was an error resetting password' });
    }
};

exports.changePassword = async (req, res) => {
    const { phone, currentPassword, newPassword } = req.body;

    try {
        let existingUser = await userModel.getUserByPhone(phone);

        if (!existingUser) {
            return res.status(401).json({ error: 'Phone number is not existed' });
        }

        const isMatch = await bcrypt.compare(currentPassword, existingUser.passwordHash);

        if (!isMatch) {
            return res.status(401).json({ 
                success: false,
                data: null,
                message: 'Current password is incorrect' 
            });
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await userModel.changePassword(phone, newPasswordHash);
        const user = await userModel.getUserByPhone(phone);

        const { passwordHash, ...safeUser } = user;
        return res.status(201).json({
            success: true,
            data: safeUser,
            message: 'Change password successfully'
        });
    } catch (error) {
        console.log("error: ", error);
        return res.status(500).json({ 
            success: false,
            data: null,
            message: 'There was an error changing password' 
        });
    }
};

exports.updateUserInformation = async (req, res) => {
    const { userId, fullName, phone, email } = req.body;

    try {
        const rsUser = await userModel.updateUserInforamtion(userId, fullName, phone, email);
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
        return res.status(400).json({ 
            success: false,
            data: null,
            message: error.message 
        });
    }
};
