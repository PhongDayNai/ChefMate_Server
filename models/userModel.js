const { poolPromise, sql } = require('../config/dbConfig');

exports.getAllUsers = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM Users');
    
    return {
        success: true,
        data: result.recordset,
        message: "Get all users successfully"
    };
};

exports.createUser = async (fullName, phone, email, passwordHash) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('FullName', sql.NVarChar, fullName)
        .input('Phone', sql.NVarChar, phone)
        .input('Email', sql.NVarChar, email)
        .input('PasswordHash', sql.NVarChar, passwordHash)
        .query('INSERT INTO Users (fullName, phone, email, passwordHash) OUTPUT INSERTED.UserID VALUES (@FullName, @Phone, @Email, @PasswordHash)');
    
    return {
        success: true,
        data: result.recordset[0],
        message: "User created successfully"
    };
};

exports.resetPassword = async (phone, passwordHash) => {
    const pool = await poolPromise;
    let user = await this.getUserByPhone(phone);
    const transaction = pool.transaction();
    try {
        await transaction.begin();

        const result = await transaction.request()
            .input('Phone', sql.NVarChar, phone)
            .input('PasswordHash', sql.NVarChar, passwordHash)
            .query('UPDATE Users SET passwordHash = @PasswordHash WHERE Phone = @Phone');

        await transaction.commit();

        user = await this.getUserByPhone(phone);

        return { 
            success: true,
            user: user,
            message: "Reset password successfully"
        };
    } catch (error) {
        console.log("error: ", error);
        throw error;
    };
};

exports.changePassword = async (phone, passwordHash) => {
    const pool = await poolPromise;
    let user = await this.getUserByPhone(phone);
    const transaction = pool.transaction();
    try {
        await transaction.begin();

        const result = await transaction.request()
            .input('Phone', sql.NVarChar, phone)
            .input('PasswordHash', sql.NVarChar, passwordHash)
            .query('UPDATE Users SET passwordHash = @PasswordHash WHERE Phone = @Phone');

        await transaction.commit();

        user = await this.getUserByPhone(phone);

        return { 
            success: true,
            user: user,
            message: "Change password successfully"
        };
    } catch (error) {
        console.log("error: ", error);
        throw error;
    };
};

exports.getPasswordHash = async (phone) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('Phone', sql.NVarChar, phone)
        .query('SELECT passwordHash FROM Users WHERE Phone = @Phone');

    return result.recordset.length > 0 ? result.recordset[0].passwordHash : null;
};

exports.getUserByPhone = async (phone) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('Phone', sql.NVarChar, phone)
        .query('SELECT * FROM Users WHERE phone = @Phone');
    
    return result.recordset.length > 0 ? result.recordset[0] : null;
};

exports.getUserByIdentifier = async (identifier) => {
    const pool = await poolPromise;
    try {
        console.log(`Querying user with identifier: ${identifier}`);
        const result = await pool.request()
            .input('Identifier', sql.NVarChar, identifier)
            .query('SELECT * FROM Users WHERE phone = @Identifier OR email = @Identifier');
        
        if (result.recordset.length > 0) {
            console.log(`User found:`, result.recordset[0]);
            return result.recordset[0];
        } else {
            console.log(`No user found with identifier: ${identifier}`);
            return null;
        }
    } catch (error) {
        console.error(`Error querying user with identifier ${identifier}:`, error);
        throw error;
    }
};

exports.updateUserInforamtion = async (userId, fullName, phone, email) => {
    const pool = await poolPromise;
    const existingPhone = await this.getUserByPhone(phone);

    if (existingPhone !== null && existingPhone.userId !== userId) {
        return {
            success: false,
            data: null,
            message: 'This phone is already exist'
        };
    } else {
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('fullName', sql.NVarChar, fullName)
            .input('phone', sql.NVarChar, phone)
            .input('email', sql.NVarChar, email)
            .query("UPDATE Users SET fullName = @fullName, phone = @phone, email = @email WHERE userId = @userId");
        
        const user = await this.getUserByPhone(phone);
        const { passwordHash, ...safeUser } = user;

        return {
            success: true,
            user: safeUser,
            message: "Update user information successfully"
        };
    };
};

exports.getRecipesViewHistory = async (userId) => {
    const pool = await poolPromise;
    
    try {
        const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query('SELECT * FROM UsersViewRecipesHistory WHERE userId = @userId');
        
        const data = {
            userId: userId,
            recipesViewHistory: result.recordset
        }

        return {
            success: true,
            data: data,
            message: "Get recipes view history successfully"
        };
    } catch (error) {
        console.log("error: ", error);
        throw error;
    };
};
