const express = require('express');
const router = express.Router();
const db = require('../database'); // your database connection

// 1️⃣ Create a new report
router.post('/', (req, res) => {
  const {
    abuse_type_id,
    subtype_id,
    description,
    reporter_email,
    phone_number,
    image_path,
    full_name,
    age,
    location,
    school_name,
    case_number,
    is_anonymous,
    status
  } = req.body;

  const query = `
    INSERT INTO reports 
    (abuse_type_id, subtype_id, description, reporter_email, phone_number, image_path, full_name, age, location, school_name, case_number, is_anonymous, status, created_at, updated_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `;

  const values = [abuse_type_id, subtype_id, description, reporter_email, phone_number, image_path, full_name, age, location, school_name, case_number, is_anonymous, status];

  db.query(query, values, (err, result) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    res.status(201).json({ message: 'Report created', reportId: result.insertId });
  });
});

// 2️⃣ Get all reports (case_number + status)
router.get('/', (req, res) => {
  const query = 'SELECT case_number, status FROM reports';
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    res.json(results);
  });
});

// 3️⃣ Get a single report by case_number (full details)
router.get('/:case_number', (req, res) => {
  const { case_number } = req.params;
  if (!case_number) return res.status(400).json({ message: 'Case number is required' });

  const query = 'SELECT * FROM reports WHERE case_number = ?';
  db.query(query, [case_number], (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Case not found' });
    res.json(results[0]);
  });
});

module.exports = router;
