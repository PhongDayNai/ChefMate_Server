const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const userRoutes = require('./routes-legacy/userRoutes');
const recipeRoutes = require('./routes-legacy/recipeRoutes');
const interactionRoutes = require('./routes-legacy/interactionRoutes');
const pantryRoutes = require('./routes-legacy/pantryRoutes');
const aiChatRoutes = require('./routes-legacy/aiChatRoutes');
const aiChatV2Routes = require('./routes-legacy/aiChatV2Routes');
const userDietRoutes = require('./routes-legacy/userDietRoutes');
const chatApiKeyAuth = require('./middleware/chatApiKeyAuth');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'assets')));
// app.use('/static', express.static(path.join(__dirname, 'assets')));

app.use('/v1/users', userRoutes);
app.use('/v1/recipes', recipeRoutes);
app.use('/v1/interactions', interactionRoutes);
app.use('/v1/pantry', pantryRoutes);
app.use('/v1/ai-chat', chatApiKeyAuth, aiChatRoutes);
app.use('/v1/ai-chat/v2', chatApiKeyAuth, aiChatV2Routes);
app.use('/v1/user-diet-notes', userDietRoutes);

app.get('/api-docs', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs', 'swagger-ui.html'));
});

app.get('/api-docs/openapi.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs', 'openapi.json'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
