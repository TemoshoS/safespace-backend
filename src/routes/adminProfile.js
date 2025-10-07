const express = require('express');
const router = express.Router();
const db = require('../database');
const verifyAdmin = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require("bcryptjs");

// Uploads folder
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Serve uploads publicly
router.use('/uploads', express.static(uploadDir));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `admin_${req.admin.id}_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

// GET admin profile
router.get('/', verifyAdmin, (req, res) => {
  const adminId = req.admin.id;
  const query = 'SELECT id, name, email, username, profile_image FROM users WHERE id = ? LIMIT 1';
  db.query(query, [adminId], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!results.length) return res.status(404).json({ message: 'Admin not found' });
    res.json(results[0]);
  });
});

// UPDATE admin profile (with optional password change)
router.put('/', verifyAdmin, upload.single('profile_image'), async (req, res) => {
  const adminId = req.admin.id;

  // multer puts text fields in req.body
  const { name, email, username, currentPassword, newPassword } = req.body;

  if (!name || !email || !username) {
    return res.status(400).json({ message: 'Name, email, and username are required' });
  }

  try {
    // 🔹 Handle password change if provided
    if (currentPassword && newPassword) {
      const [rows] = await db.promise().query("SELECT password FROM users WHERE id = ?", [adminId]);
      if (!rows.length) return res.status(404).json({ message: "Admin not found" });

      const validPass = await bcrypt.compare(currentPassword, rows[0].password);
      if (!validPass) return res.status(400).json({ message: "Current password is incorrect" });

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.promise().query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, adminId]);
    }

    // 🔹 Update profile (with or without new image)
    const profileImageClause = req.file ? ', profile_image = ?' : '';
    const query = `
      UPDATE users 
      SET name = ?, email = ?, username = ? ${profileImageClause}, updated_at = NOW()
      WHERE id = ?
    `;

    const params = req.file
      ? [name, email, username, `/uploads/${req.file.filename}`, adminId]
      : [name, email, username, adminId];

    await db.promise().query(query, params);

    // Return updated data
    const [updated] = await db.promise().query(
      'SELECT id, name, email, username, profile_image FROM users WHERE id = ?',
      [adminId]
    );

    res.json({ message: 'Profile updated successfully', ...updated[0] });
  } catch (err) {
    console.error("❌ Profile update error:", err);
    res.status(500).json({ message: err.message });
  }
});




module.exports = router;
