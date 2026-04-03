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
const aiChatV2Routes = require('./routes/aiChatV2Routes');
const userDietRoutes = require('./routes/userDietRoutes');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'assets')));

app.use('/v2/users', userRoutes);
app.use('/v2/recipes', recipeRoutes);
app.use('/v2/interactions', interactionRoutes);
app.use('/v2/pantry', pantryRoutes);
app.use('/v2/ai-chat', aiChatRoutes);
app.use('/v2/ai-chat/v2', aiChatV2Routes);
app.use('/v2/user-diet-notes', userDietRoutes);

app.get('/api-docs', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs', 'swagger-ui.html'));
});

app.get('/api-docs/openapi.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs', 'openapi.json'));
});

const PORT = process.env.PORT || 13081;
app.listen(PORT, () => {
    console.log(`JWT server đang chạy tại http://localhost:${PORT}`);
});
