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
    const { phone, password, fullName } = req.body;
    console.log('req.body:', req)
    console.log('password:', password)
    console.log('fullName:', fullName)
    console.log('phone:', phone)

    try {
        const existingUser = await userModel.getUserByPhone(phone);
        console.log('Existing User:', existingUser);

        if (existingUser) {
            return res.status(400).json({ error: 'Số điện thoại đã được sử dụng' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const newUser = await userModel.createUser(fullName, phone, passwordHash);
        console.log('New User:', newUser);

        const user = await userModel.getUserByPhone(phone);
        console.log('User:', user);

        res.status(201).json({ message: 'Đăng ký thành công', userId: user.UserID, fullName: user.FullName, points: user.Points });
    } catch (error) {
        console.log('Error:', error);
        res.status(500).json({ error: 'Có lỗi xảy ra khi đăng ký' });
    }
};

exports.login = async (req, res) => {
    const { phone, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ error: 'Số điện thoại và mật khẩu là bắt buộc' });
    }
    
    try {
        const user = await userModel.getUserByPhone(phone)

        if (!user) {
            return res.status(401).json({ error: 'Số điện thoại không tồn tại' });
        }

        console.log('User:', user);
        const isMatch = await bcrypt.compare(password, user.PasswordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Mật khẩu không chính xác' });
        }

        res.status(200).json({ message: 'Đăng nhập thành công', userId: user.UserID, fullName: user.FullName, points: user.Points });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Có lỗi xảy ra khi đăng nhập' });
    }
};

exports.resetPassword = async (req, res) => {
    const { phone } = req.body;

    try {
        let existingUser = await userModel.getUserByPhone(phone);

        if (!user) {
            return res.status(401).json({ error: 'Số điện thoại không tồn tại' });
        }

        const passwordHash = await bcrypt.hash("1", 10);
        const rsUser = await userModel.resetPassword(phone, passwordHash);
        user = await userModel.getUserByPhone(phone);

        console.log("User: ", user);
        return res.status(201).json({ message: 'Reset mật khẩu thành công', userId: user.UserID });
    } catch (error) {
        console.log("error: ", error);
        return res.status(500).json({ error: 'Có lỗi khi reset mật khẩu' });
    }
};

exports.changePassword = async (req, res) => {
    const { phone, newPassword } = req.body;

    try {
        let existingUser = await userModel.getUserByPhone(phone);

        if (!user) {
            return res.status(401).json({ error: 'Số điện thoại không tồn tại' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        const rsUser = await userModel.resetPassword(phone, passwordHash);
        user = await userModel.getUserByPhone(phone);

        console.log("User: ", user);
        return res.status(201).json({ message: 'Thay đổi mật khẩu thành công', userId: user.UserID });
    } catch (error) {
        console.log("error: ", error);
        return res.status(500).json({ error: 'Có lỗi khi thay đổi mật khẩu' });
    }
};

exports.updateUserInformation = async (req, res) => {
    const { userId, fullName, phone } = req.body;

    try {
        const rsUser = await userModel.updateUserInforamtion(userId, fullName, phone);
        return res.status(200).json({ userId, fullName, phone, rsUser });
    } catch (error) {
        console.log("error: ", error);
        return res.status(500).json({ error: 'Có lỗi khi thay đổi mật khẩu' });
    }
};

exports.getRecipesViewHistory = async (req, res) => {
    const { userId } = req.body;

    try {
        const recipesViewHistory = await userModel.getRecipesViewHistory(userId);
        return res.status(200).json({ userId, recipesViewHistory });
    } catch (error) {
        console.error("error: ", error);
        return res.status(400).json({ error: error.message });
    }
};
