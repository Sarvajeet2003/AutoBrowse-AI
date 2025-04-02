const express = require('express');
const { browserController } = require('../browser/controller');

const router = express.Router();

router.post('/', async(req, res) => {
    try {
        const { selectors } = req.body;

        if (!selectors || Object.keys(selectors).length === 0) {
            return res.status(400).json({ error: 'Selectors are required' });
        }

        const data = await browserController.extractData(selectors);

        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error extracting data:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to extract data'
        });
    }
});

module.exports = { extractRouter: router };