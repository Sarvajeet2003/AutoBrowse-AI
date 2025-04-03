const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routers - add error handling to identify which import is failing
let interactRouter, extractRouter, nativeBrowserRouter, automationFlowRouter, conversationRouter, schedulerRouter;

try {
    interactRouter = require('./api/interact');
    console.log('Successfully imported interact router');
} catch (error) {
    console.error('Error importing interact router:', error);
}

try {
    extractRouter = require('./api/extract');
    console.log('Successfully imported extract router');
} catch (error) {
    console.error('Error importing extract router:', error);
}

try {
    nativeBrowserRouter = require('./api/nativeBrowser');
    console.log('Successfully imported native browser router');
} catch (error) {
    console.error('Error importing native browser router:', error);
}

try {
    automationFlowRouter = require('./api/automationFlow');
    console.log('Successfully imported automation flow router');
} catch (error) {
    console.error('Error importing automation flow router:', error);
}

// Import new Level 3 routers
try {
    conversationRouter = require('./api/conversation');
    console.log('Successfully imported conversation router');
} catch (error) {
    console.error('Error importing conversation router:', error);
}

try {
    schedulerRouter = require('./api/scheduler');
    console.log('Successfully imported scheduler router');
} catch (error) {
    console.error('Error importing scheduler router:', error);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API routes
if (interactRouter) {
    app.use('/api/interact', interactRouter);
}

if (extractRouter) {
    app.use('/api/extract', extractRouter);
}

if (nativeBrowserRouter) {
    app.use('/api/native-browser', nativeBrowserRouter);
}

if (automationFlowRouter) {
    // The issue is likely in how the routes are registered
    // Your index.js shows that you're importing the router but may not be using it correctly
    
    // Make sure you have this line after initializing your Express app:
    app.use('/api/automation/flow', automationFlowRouter);
}

// Add new Level 3 routes
if (conversationRouter) {
    app.use('/api/conversation', conversationRouter);
}

if (schedulerRouter) {
    app.use('/api/scheduler', schedulerRouter);
}

// Serve the main HTML file for any other route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', async() => {
    const { browserController } = require('./browser/controller');
    console.log('Shutting down server...');
    await browserController.close();
    process.exit(0);
});