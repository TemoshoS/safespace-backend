const express = require('express');
const router = express.Router();
const db = require('../database'); 
const verifyAdmin = require('../middleware/auth');

// GET all abuse reports
router.get('/',verifyAdmin, (req, res) => {
    db.query('SELECT * FROM abuse_reports', (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

module.exports = router; 
