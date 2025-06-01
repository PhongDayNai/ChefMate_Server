const { poolPromise, sql } = require('../config/dbConfig');

exports.getAllUsers = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM Users');
    return result.recordset;
};

exports.createUser = async (fullName, phone, passwordHash) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('FullName', sql.NVarChar, fullName)
        .input('Phone', sql.NVarChar, phone)
        .input('PasswordHash', sql.NVarChar, passwordHash)
        .query('INSERT INTO Users (FullName, Phone, PasswordHash) OUTPUT INSERTED.UserID VALUES (@FullName, @Phone, @PasswordHash)');
    return result.recordset[0];
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
            .query('UPDATE Users SET PasswordHash = @PasswordHash WHERE Phone = @Phone');

        await transaction.commit();

        user = await this.getUserByPhone(phone);

        return { user }
    } catch (error) {
        console.log("error: ", error);
        throw error;
    }
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
            .query('UPDATE Users SET PasswordHash = @PasswordHash WHERE Phone = @Phone');

        await transaction.commit();

        user = await this.getUserByPhone(phone);

        return { user }
    } catch (error) {
        console.log("error: ", error);
        throw error;
    }
};

exports.getUserByPhone = async (phone) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('Phone', sql.NVarChar, phone)
        .query('SELECT * FROM Users WHERE Phone = @Phone');
    return result.recordset.length > 0 ? result.recordset[0] : null;
};

exports.updateUserInforamtion = async (userId, fullName, phone) => {
    const pool = await poolPromise;
    const existingPhone = await this.getUserByPhone(phone);

    if (existingPhone !== null && existingPhone.userId !== userId) {
        return {
            success: false,
            message: 'This phone is already exist'
        }
    } else {
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .input('fullName', sql.NVarChar, fullName)
            .input('phone', sql.NVarChar, phone)
            .query("UPDATE Users SET fullName = @fullName, phone = @phone WHERE userId = @userId");
        
        const user = await this.getUserByPhone(phone);
        return {
            success: true,
            user: user
        }
    }
};

exports.getRecipesViewHistory = async (userId) => {
    const pool = await poolPromise;
    
    try {
        const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query('SELECT * FROM UsersViewRecipesHistory WHERE UserId = @userId');
        
        return result.recordset;
    } catch (error) {
        console.log("error: ", error);
        throw error;
    }
}
