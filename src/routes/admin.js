require('dotenv').config();
const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendVerificationEmail } = require('../utils/mailer');

const SECRET_KEY = process.env.SECRET_KEY || 'fallbacksecret';

// Validate login (check username/password before sending email)
router.post('/validate-login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password)
        return res.status(400).json({ message: 'Username and password required' });

    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Server error' });

        if (results.length === 0)
            return res.status(401).json({ message: 'Invalid username or password' });

        const user = results[0];

        // Compare the provided password with hashed password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch)
            return res.status(401).json({ message: 'Invalid username or password' });

        // Optional: check if already verified
        if (user.verified === 1) {
            return res.status(200).json({ message: 'Already verified. You can proceed to login.' });
        }

        return res.status(200).json({ message: 'Valid credentials' });
    });
});

// Login → send verification code only if email matches
router.post('/login', (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password || !email)
        return res.status(400).json({ message: 'Username, password and email required' });

    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Server error' });
        if (results.length === 0) return res.status(401).json({ message: 'Invalid username or password' });

        const user = results[0];

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) return res.status(401).json({ message: 'Invalid username or password' });

        if (user.email_verified_at && user.email_verified_at !== null && user.verified === 1) {
            return res.status(200).json({ message: 'Already verified. You can log in.' });
        }

        if (user.username !== username || email !== user.email) {
            return res.status(401).json({ message: 'Email does not match user record' });
        }


        const verificationCode = Math.floor(100000 + Math.random() * 900000);

        const saveCodeQuery = 'UPDATE users SET verification_code = ?, verified = 0 WHERE username = ?';
        db.query(saveCodeQuery, [verificationCode, username], async (err) => {
            if (err) return res.status(500).json({ message: 'Server error saving code' });

            try {
                await sendVerificationEmail(email, verificationCode);
                return res.status(200).json({ message: 'Login successful. Verification code sent to email.' });
            } catch (err) {
                return res.status(500).json({ message: 'Error sending email', error: err.message });
            }
        });
    });
});

// Verify Code + return JWT
router.post('/verify', (req, res) => {
    const { username, code } = req.body;

    if (!username || !code)
        return res.status(400).json({ message: 'Username and code required' });

    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], (err, results) => {
        if (err) return res.status(500).json({ message: 'Server error' });
        if (results.length === 0) return res.status(404).json({ message: 'User not found' });

        const user = results[0];

        if (user.verification_code == code) {
            const updateQuery = `
                UPDATE users
                SET verified = 1,
                    verification_code = NULL,
                    email_verified_at = NOW()
                WHERE username = ?`;
            db.query(updateQuery, [username], (err) => {
                if (err) return res.status(500).json({ message: 'Error updating verified status' });

                const token = jwt.sign(
                    { id: user.id, username: user.username, role: 'user' },
                    SECRET_KEY,
                    { expiresIn: '2h' }
                );

                return res.status(200).json({
                    message: 'User verified successfully!',
                    token,
                    username: user.username
                });
            });
        } else {
            return res.status(401).json({ message: 'Invalid verification code' });
        }
    });
});

// Logout
router.post('/logout', (req, res) => {
    return res.status(200).json({ message: 'Logged out successfully' });
});

module.exports = router;
