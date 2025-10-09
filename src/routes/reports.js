const express = require('express');
const router = express.Router();
const db = require('../database'); 
const nodemailer = require('nodemailer');
const verifyAdmin = require('../middleware/auth');
const { sendStatusEmail } = require('../utils/mailer');

// 1️⃣ Configure Nodemailer
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'janetlehike@gmail.com',
    pass: 'xvanjiuoudmhmgrc' // Gmail App Password
  }
});

// Generate Case Number
const abuseTypeMap = {
  1: "BU",
  2: "SB",
  3: "SX",
  4: "TP",
  5: "WP",
  6: "VL"
};

const generateCaseNumber = (abuse_type_id) => {
  const prefix = abuseTypeMap[abuse_type_id] || "XX";
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `CASE-${prefix}${randomDigits}`;
};

// 2️⃣ Create a new report
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

    // Send confirmation email
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

// 3️⃣ Get all reports (admin detailed view)
router.get('/', verifyAdmin, (req, res) => {
  const query = `
    SELECT 
      reports.id,
      reports.case_number,
      reports.reporter_email,
      reports.phone_number,
      reports.description,
      reports.image_path,
      reports.created_at,
      reports.status,
      abuse_types.type_name AS abuse_type,
      subtypes.sub_type_name AS subtype
    FROM reports
    LEFT JOIN abuse_types ON reports.abuse_type_id = abuse_types.id
    LEFT JOIN subtypes ON reports.subtype_id = subtypes.id
    ORDER BY reports.created_at DESC
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    res.json(results);
  });
});

// 4️⃣ Get a single report by case_number
router.get('/case/:case_number', (req, res) => {
  const { case_number } = req.params;
  if (!case_number) return res.status(400).json({ message: 'Case number is required' });

  const query = 'SELECT * FROM reports WHERE case_number = ?';
  db.query(query, [case_number], (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Case not found' });
    res.json(results[0]);
  });
});

// 5️⃣ GET subtypes for a given abuse type
router.get('/subtypes/:abuse_type_id', (req, res) => {
  const { abuse_type_id } = req.params;
  if (!abuse_type_id) return res.status(400).json({ message: 'Abuse type ID is required' });

  const query = 'SELECT id, sub_type_name FROM subtypes WHERE abuse_type_id = ?';
  db.query(query, [abuse_type_id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    res.json(results);
  });
});

// 6️⃣ Update report by case_number
router.put('/:case_number', (req, res) => {
  const { case_number } = req.params;
  const {
    description,
    phone_number,
    full_name,
    age,
    location,
    school_name,
    status,
    reason
  } = req.body;

  const query = `
    UPDATE reports
    SET description = ?, phone_number = ?, full_name = ?, age = ?, location = ?, school_name = ?, status = ?, reason = ?, updated_at = NOW()
    WHERE case_number = ?
  `;

  const values = [description, phone_number, full_name, age, location, school_name, status, reason, case_number];

  db.query(query, values, (err, result) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Report not found' });

    res.json({ message: 'Report updated successfully', case_number });
  });
});

// 7️⃣ Update status + reason by report ID + send email
router.patch('/:id', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!status || !reason) return res.status(400).json({ message: 'Status and reason are required' });

  // Update report
  db.query(
    'UPDATE reports SET status = ?, reason = ?, updated_at = NOW() WHERE id = ?',
    [status, reason, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Server error', error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Report not found' });

      // Fetch reporter info to send email
      db.query(
        'SELECT reporter_email, full_name, case_number FROM reports WHERE id = ?',
        [id],
        async (err2, rows) => {
          if (err2 || rows.length === 0) {
            return res.json({ message: 'Status updated but email not sent' });
          }

          const { reporter_email, full_name, case_number } = rows[0];

          try {
            await sendStatusEmail(reporter_email, full_name, case_number, status);
            res.json({ message: 'Status and reason updated, email sent' });
          } catch (e) {
            console.error('Email error:', e);
            res.json({ message: 'Status updated but failed to send email' });
          }
        }
      );
    }
  );
});

module.exports = router;
