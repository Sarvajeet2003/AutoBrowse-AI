const express = require('express');
const { taskScheduler } = require('../scheduler/taskScheduler');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get all scheduled tasks
router.get('/', (req, res) => {
    try {
        const tasks = taskScheduler.getAllTasks();
        res.json({
            success: true,
            tasks
        });
    } catch (error) {
        console.error('Error getting scheduled tasks:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'An unknown error occurred'
        });
    }
});

// Get a specific task by ID
router.get('/:id', (req, res) => {
    try {
        const task = taskScheduler.getTask(req.params.id);
        
        if (!task) {
            return res.status(404).json({
                success: false,
                error: `Task with ID ${req.params.id} not found`
            });
        }
        
        res.json({
            success: true,
            task
        });
    } catch (error) {
        console.error('Error getting task:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'An unknown error occurred'
        });
    }
});

// Create a new scheduled task
router.post('/', (req, res) => {
    try {
        const { name, schedule, workflow, browserConfig } = req.body;
        
        if (!schedule || !workflow) {
            return res.status(400).json({
                success: false,
                error: 'Schedule and workflow are required'
            });
        }
        
        const taskId = uuidv4();
        const taskConfig = {
            id: taskId,
            name: name || `Task ${taskId.substring(0, 8)}`,
            schedule,
            workflow,
            browserConfig,
            createdAt: new Date().toISOString()
        };
        
        const success = taskScheduler.scheduleTask(taskConfig);
        
        if (!success) {
            return res.status(500).json({
                success: false,
                error: 'Failed to schedule task'
            });
        }
        
        res.status(201).json({
            success: true,
            message: 'Task scheduled successfully',
            task: taskScheduler.getTask(taskId)
        });
    } catch (error) {
        console.error('Error creating scheduled task:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'An unknown error occurred'
        });
    }
});

// Update an existing task
router.put('/:id', (req, res) => {
    try {
        const taskId = req.params.id;
        const existingTask = taskScheduler.getTask(taskId);
        
        if (!existingTask) {
            return res.status(404).json({
                success: false,
                error: `Task with ID ${taskId} not found`
            });
        }
        
        const { name, schedule, workflow, browserConfig } = req.body;
        
        const taskConfig = {
            id: taskId,
            name: name || existingTask.name,
            schedule: schedule || existingTask.schedule,
            workflow: workflow || existingTask.workflow,
            browserConfig: browserConfig || existingTask.browserConfig,
            createdAt: existingTask.createdAt,
            updatedAt: new Date().toISOString()
        };
        
        const success = taskScheduler.scheduleTask(taskConfig);
        
        if (!success) {
            return res.status(500).json({
                success: false,
                error: 'Failed to update task'
            });
        }
        
        res.json({
            success: true,
            message: 'Task updated successfully',
            task: taskScheduler.getTask(taskId)
        });
    } catch (error) {
        console.error('Error updating scheduled task:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'An unknown error occurred'
        });
    }
});

// Delete a task
router.delete('/:id', (req, res) => {
    try {
        const taskId = req.params.id;
        const existingTask = taskScheduler.getTask(taskId);
        
        if (!existingTask) {
            return res.status(404).json({
                success: false,
                error: `Task with ID ${taskId} not found`
            });
        }
        
        const success = taskScheduler.cancelTask(taskId);
        
        if (!success) {
            return res.status(500).json({
                success: false,
                error: 'Failed to delete task'
            });
        }
        
        res.json({
            success: true,
            message: 'Task deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting scheduled task:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'An unknown error occurred'
        });
    }
});

module.exports = router;