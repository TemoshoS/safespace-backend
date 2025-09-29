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
    user: 'nhlakaexcellent9@gmail.com',
    pass: 'vhwkevnjnuoqrruh'  // App password
  }
});





// 2️⃣ Generate unique case number
const generateCaseNumber = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CASE-${result}`;
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

  const case_number = generateCaseNumber();

  const query = `
    INSERT INTO reports
    (abuse_type_id, subtype_id, description, reporter_email, phone_number, full_name, age, location, school_name, case_number, status, is_anonymous, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `;

  const values = [abuse_type_id, subtype_id, description, reporter_email, phone_number, full_name, age, location, school_name, case_number, status, is_anonymous];

  db.query(query, values, (err, result) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });

    // 4️⃣ Send email with case number
    const mailOptions = {
      from: '"Safe Space" <nhlakaexcellent9@gmail.com>',
      to: reporter_email,
      subject: 'Safe Space - Report Confirmation',
      text: `Hello ${full_name || 'User'},\n\nYour report has been created successfully!\nCase Number: ${case_number}\n\nThank you for reporting.`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        // Not failing the request if email fails
      } else {
        console.log('Email sent:', info.response);
      }
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

router.get('/test-db', (req, res) => {
  db.query('SELECT COUNT(*) AS total FROM reports', (err, results) => {
    if (err) return res.status(500).json({ message: 'DB connection failed', error: err.message });
    res.json({ message: 'DB connected!', totalReports: results[0].total });
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

// Update report status and notify user
router.put('/:case_number/status', (req, res) => {
  const { case_number } = req.params;
  const { status } = req.body;

  if (!status) return res.status(400).json({ message: 'Status is required' });

  const selectQuery = 'SELECT * FROM reports WHERE case_number = ?';
  db.query(selectQuery, [case_number], (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Report not found' });

    const report = results[0];

    const updateQuery = 'UPDATE reports SET status = ?, updated_at = NOW() WHERE case_number = ?';
    db.query(updateQuery, [status, case_number], (err2) => {
      if (err2) return res.status(500).json({ message: 'Server error', error: err2.message });

      // Send email notification
      const mailOptions = {
        from: '"Safe Space" <nhlakaexcellent9@gmail.com>',
        to: report.reporter_email,
        subject: 'Safe Space - Report Status Update',
        text: `Hello ${report.full_name || 'User'},\n\nYour report (Case: ${case_number}) status is now: ${status}.\n\nThank you.`
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) console.error('Email error:', error);
        else console.log('Status email sent:', info.response);
      });

      res.json({ message: 'Status updated and user notified', case_number, newStatus: status });
    });
  });
});


module.exports = router;
