const express = require('express');
const { browserController } = require('../browser/controller');

const router = express.Router();

router.post('/', async(req, res) => {
    try {
        const { selectors, options } = req.body;

        if (!selectors || Object.keys(selectors).length === 0) {
            return res.status(400).json({ error: 'Selectors are required' });
        }

        const extractionOptions = options || {};
        const data = await browserController.extractData(selectors, extractionOptions);

        return res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Error extracting data:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'An unknown error occurred'
        });
    }
});

// Add a new endpoint for structured data extraction with schema
router.post('/structured', async(req, res) => {
    try {
        const { schema, url } = req.body;

        if (!schema) {
            return res.status(400).json({ error: 'Schema is required' });
        }

        // Navigate to URL if provided
        if (url) {
            await browserController.navigate(url);
        }

        // Process the schema to extract structured data
        const result = {};

        for (const [key, definition] of Object.entries(schema)) {
            try {
                // Handle different types of data extraction
                if (definition.type === 'list') {
                    // Extract a list of items
                    const containerSelector = definition.container;
                    const itemSelector = definition.itemSelector;
                    const properties = definition.properties || {};

                    const items = [];

                    // Wait for container
                    await browserController.page.waitForSelector(containerSelector, { timeout: 5000 });

                    // Get all items
                    const itemElements = await browserController.page.$$(itemSelector);

                    // Extract properties for each item
                    for (const itemElement of itemElements) {
                        const item = {};

                        for (const [propName, propSelector] of Object.entries(properties)) {
                            try {
                                let value;
                                if (typeof propSelector === 'string') {
                                    // Simple selector
                                    const propElement = await itemElement.$(propSelector);
                                    if (propElement) {
                                        value = await propElement.evaluate(el => el.textContent.trim());
                                    }
                                } else {
                                    // Complex selector with attribute
                                    const propElement = await itemElement.$(propSelector.selector);
                                    if (propElement) {
                                        if (propSelector.attribute === 'textContent') {
                                            value = await propElement.evaluate(el => el.textContent.trim());
                                        } else if (propSelector.attribute === 'html') {
                                            value = await propElement.evaluate(el => el.innerHTML);
                                        } else {
                                            value = await propElement.evaluate(
                                                (el, attr) => el.getAttribute(attr),
                                                propSelector.attribute
                                            );
                                        }
                                    }
                                }
                                item[propName] = value || null;
                            } catch (propError) {
                                console.error(`Error extracting property ${propName}:`, propError);
                                item[propName] = null;
                            }
                        }

                        items.push(item);
                    }

                    result[key] = items;
                } else if (definition.type === 'single') {
                    // Extract a single item
                    const selector = definition.selector;
                    const attribute = definition.attribute || 'textContent';

                    let value = null;
                    try {
                        await browserController.page.waitForSelector(selector, { timeout: 5000 });
                        const element = await browserController.page.$(selector);

                        if (element) {
                            if (attribute === 'textContent') {
                                value = await element.evaluate(el => el.textContent.trim());
                            } else if (attribute === 'html') {
                                value = await element.evaluate(el => el.innerHTML);
                            } else {
                                value = await element.evaluate(
                                    (el, attr) => el.getAttribute(attr),
                                    attribute
                                );
                            }
                        }
                    } catch (selectorError) {
                        console.error(`Error extracting single item ${key}:`, selectorError);
                    }

                    result[key] = value;
                }
            } catch (schemaError) {
                console.error(`Error processing schema for ${key}:`, schemaError);
                result[key] = null;
            }
        }

        return res.json({
            success: true,
            data: result,
            metadata: {
                url: await browserController.page.url(),
                title: await browserController.page.title(),
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error extracting structured data:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'An unknown error occurred'
        });
    }
});

module.exports = router;