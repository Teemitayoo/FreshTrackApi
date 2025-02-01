const express = require('express');
const router = express.Router();
const User = require('../models/user-model');
const Item = require('../models/item-model')
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


const JWT_SECRET = "testsecrethahaha";


router.get('/health', (req, res) => {
    res.status(200).json({ message: 'Server is running' });
});


// SIGNUP Endpoint
router.post('/signup', async (req, res) => {
    const { fullname, email, password } = req.body;

    try {
        // Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists. Please sign in.' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user
        const newUser = new User({ fullname, email, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ 
            message: 'User registered successfully', 
            user: { 
                id: newUser._id, 
                fullname: newUser.fullname, 
                email: newUser.email 
            } 
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SIGNIN Endpoint
router.post('/signin', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if the user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found. Please sign up.' });
        }

        // Check if the password matches
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Generate a JWT token
        const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
            expiresIn: '1h',
        });

        res.status(200).json({ message: 'Sign in successful', token, userId: user._id });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/edit-user/:id', async (req, res) => {
    const { id } = req.params;
    const { fullname, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        // Update the user fields that are provided
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { fullname, email, password: hashedPassword }, // Update only the fields passed in the request body
            { new: true } // Return the updated user document
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Remove the password field from the response
        updatedUser.password = undefined;

        res.status(200).json({ message: 'User updated successfully', user: updatedUser });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});




router.post('/add-item', async (req, res) => {
    try {
        const { name, category, expiryDate, notes, userId } = req.body;

        // Validate the request body
        if (!name || !category || !expiryDate || !userId) {
            return res.status(400).json({ message: 'All required fields must be filled' });
        }

        // Create a new item
        const newItem = new Item({
            name,
            category,
            expiryDate,
            notes,
            addedBy: userId,
        });

        // Save the item to the database
        const savedItem = await newItem.save();
        res.status(201).json({ message: 'Item added successfully', item: savedItem });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.put('/edit-item/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, expiryDate, notes } = req.body;

        if (!name && !category && !expiryDate && !notes) {
            return res.status(400).json({ message: 'At least one field is required to update' });
        }

        const updatedItem = await Item.findByIdAndUpdate(
            id,
            { name, category, expiryDate, notes },
            { new: true, runValidators: true }
        );

        if (!updatedItem) {
            return res.status(404).json({ message: 'Item not found' });
        }

        res.status(200).json({ message: 'Item updated successfully', item: updatedItem });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Delete an item
router.delete('/delete-item/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const deletedItem = await Item.findByIdAndDelete(id);

        if (!deletedItem) {
            return res.status(404).json({ message: 'Item not found' });
        }

        res.status(200).json({ message: 'Item deleted successfully', item: deletedItem });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/dashboard/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // Find all items added by this user
        const items = await Item.find({ addedBy: userId });

        if (items.length === 0) {
            return res.status(404).json({ message: 'No items found for this user' });
        }

        // Create a map of item names and expiry dates
        const itemMap = items.reduce((map, item) => {
            map[item.name] = item.expiryDate;
            return map;
        }, {});

        res.status(200).json({
            message: 'User dashboard fetched successfully',
            items: itemMap,
        });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});


router.get('/statistics/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // 1. Pie Chart: Count expired vs. active items
        const currentDate = new Date();
        const expiredCount = await Item.countDocuments({ userId, expiryDate: { $lt: currentDate } });
        const activeCount = await Item.countDocuments({ userId, expiryDate: { $gte: currentDate } });

        // 2. Line Chart: Monthly waste trends (count of expired items by month)
        const monthlyWasteTrends = await Item.aggregate([
            { $match: { userId, expiryDate: { $lt: currentDate } } },
            {
                $group: {
                    _id: { month: { $month: '$expiryDate' }, year: { $year: '$expiryDate' } },
                    expiredCount: { $sum: 1 },
                },
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 },
            },
        ]);

        // 3. Bar Chart: Most frequently expired items
        const mostExpiredItems = await Item.aggregate([
            { $match: { userId, expiryDate: { $lt: currentDate } } },
            {
                $group: {
                    _id: '$itemName',
                    count: { $sum: 1 },
                },
            },
            { $sort: { count: -1 } },
            { $limit: 5 }, // Top 5 most expired items
        ]);

        // Send the aggregated data
        res.status(200).json({
            pieChart: { expired: expiredCount, active: activeCount },
            lineChart: monthlyWasteTrends.map(trend => ({
                month: trend._id.month,
                year: trend._id.year,
                expiredCount: trend.expiredCount,
            })),
            barChart: mostExpiredItems.map(item => ({
                itemName: item._id,
                count: item.count,
            })),
        });
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
module.exports = router;
