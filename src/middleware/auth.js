const express = require('express');
const router = express.Router();
const db = require('../database'); // adjust path if needed
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// validate-login route
router.post('/validate-login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ message: 'Username and password required' });

    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Server error' });
        if (results.length === 0)
            return res.status(401).json({ message: 'Invalid username or password' });

        const user = results[0];
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch)
            return res.status(401).json({ message: 'Invalid username or password' });

        return res.status(200).json({ message: 'Valid credentials' });
    });
});

module.exports = router;
