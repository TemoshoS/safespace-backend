const express = require('express');
const router = express.Router();
const db = require('../database');

// POST /admin/login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    // Query admin table
    const query = 'SELECT * FROM admin WHERE username = ? AND password = ?';
    db.query(query, [username, password], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Server error' });
        }

        if (results.length > 0) {
            const admin = results[0];
            return res.status(200).json({
                message: 'Login successful',
                admin: {
                    id: admin.id,
                    username: admin.username,
                    full_name: admin.full_name,
                    id_number: admin.id_number,
                    school_email: admin.school_email,
                    admin_email: admin.admin_email,
                    phone_number: admin.phone_number
                }
            });
        } else {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
    });
});

module.exports = router;
