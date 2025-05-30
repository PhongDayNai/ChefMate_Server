const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const userRoutes = require('./routes/userRoutes');
// const recipeRoutes = require('./routes/recipeRoutes');
// const interactionRoutes = require('./routes/interactionRoutes');

const app = express();

app.use(cors());
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'assets')));
// app.use('/static', express.static(path.join(__dirname, 'assets')));

app.use('/api/users', userRoutes);
// app.use('/api/recipes', recipeRoutes);
// app.use('/api/interactions', interactionRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
