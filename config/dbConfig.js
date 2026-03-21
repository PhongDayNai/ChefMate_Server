require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'chefmate_db',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    charset: 'utf8mb4'
});

pool.getConnection()
    .then((conn) => {
        console.log('Đã kết nối MySQL');
        conn.release();
    })
    .catch((err) => {
        console.error('Lỗi kết nối MySQL', err);
    });

module.exports = {
    pool
};
