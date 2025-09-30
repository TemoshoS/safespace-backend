const express = require('express');
const router = express.Router();
const db = require('../database');
const verifyAdmin = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads'); // folder for images
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `admin_${req.admin.id}_${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

// ✅ GET logged-in admin profile
router.get('/', verifyAdmin, (req, res) => {
  const adminId = req.admin.id;
  const query = 'SELECT id, name, email, username, profile_image FROM users WHERE id = ? LIMIT 1';
  db.query(query, [adminId], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Admin not found' });
    res.json(results[0]);
  });
});

// ✅ UPDATE logged-in admin profile (with image upload)
router.put('/', verifyAdmin, upload.single('profile_image'), (req, res) => {
  const adminId = req.admin.id;
  const { name, email, username } = req.body;
  let profileImage = req.file ? `/uploads/${req.file.filename}` : null;

  if (!name || !email || !username) {
    return res.status(400).json({ message: 'Name, email and username are required' });
  }

  const query = `
    UPDATE users 
    SET name = ?, email = ?, username = ?, profile_image = COALESCE(?, profile_image), updated_at = NOW()
    WHERE id = ?
  `;
  db.query(query, [name, email, username, profileImage, adminId], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: 'Email or username already exists' });
      }
      return res.status(500).json({ message: err.message });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    res.json({ message: 'Profile updated successfully', profile_image: profileImage });
  });
});

module.exports = router;
