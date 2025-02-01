const mongoose = require('mongoose');

const itemSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    expiryDate: {
        type: Date,
        required: true,
    },
    notes: {
        type: String,
        default: '',
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId, // To reference the user who added the item
        ref: 'User',
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Item', itemSchema);
