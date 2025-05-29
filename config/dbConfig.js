require('dotenv').config();
const sql = require('mssql');

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '1234',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || '',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('Đã kết nối SQL Server');
    return pool;
  })
  .catch(err => {
    console.error('Lỗi kết nối SQL Server', err);
  });

module.exports = {
  sql, 
  poolPromise
};
