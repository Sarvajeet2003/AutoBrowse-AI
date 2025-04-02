const express = require('express');
const cors = require('cors');
const path = require('path');
const { interactRouter } = require('./api/interact');
const { extractRouter } = require('./api/extract');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/interact', interactRouter);
app.use('/api/extract', extractRouter);

// Root endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API info endpoint
app.get('/api', (req, res) => {
    res.json({
        message: 'AI Browser Automation API',
        endpoints: {
            interact: '/api/interact',
            extract: '/api/extract'
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});