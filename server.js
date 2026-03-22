const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const userRoutes = require('./routes/userRoutes');
const recipeRoutes = require('./routes/recipeRoutes');
const interactionRoutes = require('./routes/interactionRoutes');
const pantryRoutes = require('./routes/pantryRoutes');
const aiChatRoutes = require('./routes/aiChatRoutes');
const userDietRoutes = require('./routes/userDietRoutes');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'assets')));
// app.use('/static', express.static(path.join(__dirname, 'assets')));

app.use('/api/users', userRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/pantry', pantryRoutes);
app.use('/api/ai-chat', aiChatRoutes);
app.use('/api/user-diet-notes', userDietRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
