const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routers - add error handling to identify which import is failing
let interactRouter, extractRouter, nativeBrowserRouter;

try {
    interactRouter = require('./api/interact');
    console.log('Successfully imported interact router');
} catch (error) {
    console.error('Error importing interact router:', error.message);
}

try {
    extractRouter = require('./api/extract');
    console.log('Successfully imported extract router');
} catch (error) {
    console.error('Error importing extract router:', error.message);
}

try {
    nativeBrowserRouter = require('./api/nativeBrowser');
    console.log('Successfully imported nativeBrowser router');
} catch (error) {
    console.error('Error importing nativeBrowser router:', error.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API routes - only use routers that were successfully imported
if (interactRouter) {
    app.use('/api/interact', interactRouter);
}

if (extractRouter) {
    app.use('/api/extract', extractRouter);
}

if (nativeBrowserRouter) {
    app.use('/api/native', nativeBrowserRouter);
}

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', async() => {
    const { browserController } = require('./browser/controller');
    console.log('Shutting down server...');
    await browserController.close();
    process.exit(0);
});