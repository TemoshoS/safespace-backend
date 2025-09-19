require('dotenv').config();
const express = require('express');
const router = express.Router();
const db = require('../database');
const { sendVerificationEmail } = require('../utils/mailer');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.SECRET_KEY || 'fallbacksecret';

// Validate login (check username/password before sending email)
router.post('/validate-login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ message: 'Username and password required' });

    const query = 'SELECT * FROM admin WHERE username = ? AND password = ?';
    db.query(query, [username, password], (err, results) => {
        if (err) return res.status(500).json({ message: 'Server error' });
        if (results.length > 0) return res.status(200).json({ message: 'Valid credentials' });
        return res.status(401).json({ message: 'Invalid username or password' });
    });
});

// Admin Login → send verification code only if email matches
router.post('/login', (req, res) => {
    const { username, password, admin_email } = req.body;

    if (!username || !password || !admin_email)
        return res.status(400).json({ message: 'Username, password and email required' });

    const query = 'SELECT * FROM admin WHERE username = ? AND password = ?';
    db.query(query, [username, password], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Server error' });

        if (results.length > 0) {
            const admin = results[0];

            // ✅ Correct field check
            if (admin.admin_email !== admin_email) {
                return res.status(401).json({ message: 'Email does not match admin record' });
            }

            const verificationCode = Math.floor(100000 + Math.random() * 900000);

            const saveCodeQuery = 'UPDATE admin SET verification_code = ?, verified = 0 WHERE id = ?';
            db.query(saveCodeQuery, [verificationCode, admin.id], async (err) => {
                if (err) return res.status(500).json({ message: 'Server error saving code' });

                try {
                    await sendVerificationEmail(admin_email, verificationCode);
                    return res.status(200).json({ message: 'Login successful. Verification code sent to email.' });
                } catch (err) {
                    return res.status(500).json({ message: 'Error sending email', error: err.message });
                }
            });
        } else {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
    });
});



// Verify Code + return JWT
router.post('/verify', (req, res) => {
    const { username, code } = req.body;

    if (!username || !code)
        return res.status(400).json({ message: 'Username and code required' });

    const query = 'SELECT * FROM admin WHERE username = ?';
    db.query(query, [username], (err, results) => {
        if (err) return res.status(500).json({ message: 'Server error' });

        if (results.length > 0) {
            const admin = results[0];

            if (admin.verification_code == code) {
                const updateQuery = 'UPDATE admin SET verified = 1, verification_code = NULL WHERE id = ?';
                db.query(updateQuery, [admin.id], (err) => {
                    if (err) return res.status(500).json({ message: 'Error updating verified status' });

                    // Issue JWT
                    const token = jwt.sign(
                        { id: admin.id, username: admin.username, role: 'admin' },
                        SECRET_KEY,
                        { expiresIn: '2h' }
                    );

                    return res.status(200).json({
                        message: 'Admin verified successfully!',
                        token,
                        username: admin.username
                    });
                });
            } else {
                return res.status(401).json({ message: 'Invalid verification code' });
            }
        } else {
            return res.status(404).json({ message: 'Admin not found' });
        }
    });
});

// Logout
router.post('/logout', (req, res) => {
    return res.status(200).json({ message: 'Logged out successfully' });
});

module.exports = router;
