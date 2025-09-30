const express = require('express');
const router = express.Router();
const db = require('../database'); // your database connection
const nodemailer = require('nodemailer');

// 1️⃣ Configure Nodemailer
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'janetlehike@gmail.com',   // your Gmail
    pass: 'xvanjiuoudmhmgrc'         // your Gmail App Password
  }
});

//Generate Case Number
const abuseTypeMap = {
  1: "BU", // Bullying
  2: "SB", // Substance Abuse
  3: "SX", // Sexual Abuse
  4: "TP", // Teenage Pregnancy
  5: "WP", // Weapons
  6: "VL"  // Violence
};

const generateCaseNumber = (abuse_type_id) => {
  const prefix = abuseTypeMap[abuse_type_id] || "XX"; // fallback if not found
  const randomDigits = Math.floor(100000 + Math.random() * 900000); // 6-digit number
  return `CASE-${prefix}${randomDigits}`;
};

// 3️⃣ Create a new report
router.post('/', (req, res) => {
  const {
    abuse_type_id,
    subtype_id,
    description,
    reporter_email,
    phone_number,
    full_name,
    age,
    location,
    school_name,
    status,
    is_anonymous
  } = req.body;

  const case_number = generateCaseNumber(abuse_type_id);

  const query = `
    INSERT INTO reports
    (abuse_type_id, subtype_id, description, reporter_email, phone_number, full_name, age, location, school_name, case_number, status, is_anonymous, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `;

  const values = [abuse_type_id, subtype_id, description, reporter_email, phone_number, full_name, age, location, school_name, case_number, status, is_anonymous];

  db.query(query, values, (err, result) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });

    // Send confirmation email with case number (same as before)
    const mailOptions = {
      from: '"Safe Space" <janetlehike@gmail.com>',
      to: reporter_email,
      subject: 'Safe Space - Report Confirmation',
      text: `Hello ${full_name || 'User'},\n\nYour report has been created successfully!\nCase Number: ${case_number}\n\nThank you for reporting.`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) console.error('Error sending email:', error);
      else console.log('Email sent:', info.response);
    });

    res.status(201).json({ message: 'Report created', reportId: result.insertId, case_number });
  });
});


// 5️⃣ Get all reports (case_number + status)
router.get('/', (req, res) => {
  const query = 'SELECT case_number, status FROM reports';
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    res.json(results);
  });
});

// 6️⃣ Get a single report by case_number (full details)
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

// 7️⃣ GET subtypes for a given abuse type
router.get('/subtypes/:abuse_type_id', (req, res) => {
  const { abuse_type_id } = req.params;
  if (!abuse_type_id) return res.status(400).json({ message: 'Abuse type ID is required' });

  const query = 'SELECT id, sub_type_name FROM subtypes WHERE abuse_type_id = ?';
  db.query(query, [abuse_type_id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    res.json(results);
  });
});

// ✏️ Update report by case_number
router.put('/:case_number', (req, res) => {
  const { case_number } = req.params;
  const {
    description,
    phone_number,
    full_name,
    age,
    location,
    school_name,
    status
  } = req.body;

  const query = `
    UPDATE reports
    SET description = ?, phone_number = ?, full_name = ?, age = ?, location = ?, school_name = ?, status = ?, updated_at = NOW()
    WHERE case_number = ?
  `;

  const values = [description, phone_number, full_name, age, location, school_name, status, case_number];

  db.query(query, values, (err, result) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Report not found' });

    res.json({ message: 'Report updated successfully', case_number });
  });
});


module.exports = router;