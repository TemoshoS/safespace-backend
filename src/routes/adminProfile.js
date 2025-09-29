const express = require('express');
const router = express.Router();
const db = require('../database');
const verifyAdmin = require('../middleware/auth');

// ✅ GET logged-in admin profile
router.get('/', verifyAdmin, (req, res) => {
 const adminId = req.admin.id;

  const query = 'SELECT id, name, email, username FROM users WHERE id = ? LIMIT 1';
  db.query(query, [adminId], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Admin not found' });
    res.json(results[0]);
  });
});

// ✅ UPDATE logged-in admin profile
router.put('/', verifyAdmin, (req, res) => {
  const adminId = req.admin.id;
  const { name, email, username } = req.body;

  if (!name || !email || !username) {
    return res.status(400).json({ message: 'Name, email and username are required' });
  }

  const query = `
    UPDATE users 
    SET name = ?, email = ?, username = ?, updated_at = NOW() 
    WHERE id = ?
  `;
  db.query(query, [name, email, username, adminId], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: 'Email or username already exists' });
      }
      return res.status(500).json({ message: err.message });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    res.json({ message: 'Profile updated successfully' });
  });
});

module.exports = router;
