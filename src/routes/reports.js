const express = require('express');
const router = express.Router();
const db = require('../database');
const nodemailer = require('nodemailer');
const verifyAdmin = require('../middleware/auth');
const { sendStatusEmail } = require('../utils/mailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      console.log('Creating uploads directory...');
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = 'report-' + uniqueSuffix + path.extname(file.originalname);
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Configure Nodemailer
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

// Update your POST route to handle file upload
router.post('/', upload.single('image'), async (req, res) => {
  try {
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
      status = 'Pending',
      is_anonymous = 0,
      image_base64,
      image_filename
    } = req.body;

    // Handle image file
    let image_path = null;

    // Handle base64 image upload (React Native approach)
    if (image_base64) {
      try {
        // Remove data URL prefix if present
        const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        const filename = image_filename || `report-${Date.now()}.jpg`;
        const filepath = path.join(__dirname, '../../uploads', filename);

        // Ensure uploads directory exists
        const uploadsDir = path.dirname(filepath);
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Save the file
        fs.writeFileSync(filepath, imageBuffer);
        image_path = `/uploads/${filename}`;
      } catch (base64Error) {
        console.error('❌ Error saving base64 image:', base64Error);
      }
    }
    // Handle multer file upload (fallback)
    else if (req.file) {
      image_path = `/uploads/${req.file.filename}`;
      console.log('✅ Multer file uploaded:', image_path);
    }
    else {
      console.log('ℹ️ No image uploaded');
    }

    const case_number = generateCaseNumber(abuse_type_id);

    const query = `
      INSERT INTO reports
      (abuse_type_id, subtype_id, description, reporter_email, phone_number, full_name, age, location, school_name, case_number, status, is_anonymous,  image_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const values = [
      abuse_type_id,
      subtype_id,
      description,
      reporter_email,
      phone_number,
      full_name,
      age,
      location,
      school_name,
      case_number,
      status,
      is_anonymous,
      image_path  // Now using image_path which matches your database column
    ];
    db.query(query, values, (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      // Send confirmation email
      const mailOptions = {
        from: '"Safe Space" <janetlehike@gmail.com>',
        to: reporter_email,
        subject: 'Safe Space - Report Confirmation',
        text: `Hello ${full_name || 'User'},\n\nYour report has been created successfully!\nCase Number: ${case_number}\n\nThank you for reporting.`
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) console.error('Error sending email:', error);
      });

      res.status(201).json({
        message: 'Report created successfully',
        reportId: result.insertId,
        case_number: case_number
      });
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
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

  const query = `
  SELECT 
    reports.*,
    abuse_types.type_name AS abuse_type,
    subtypes.sub_type_name AS subtype
  FROM reports
  LEFT JOIN abuse_types ON reports.abuse_type_id = abuse_types.id
  LEFT JOIN subtypes ON reports.subtype_id = subtypes.id
  WHERE reports.case_number = ?
`;

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

router.put('/:case_number', upload.single('image'), (req, res) => {
  const { case_number } = req.params;
  const {
    description,
    phone_number,
    full_name,
    age,
    location,
    school_name,
    status,
    reason,
    subtype_id
  } = req.body;

  if (!description || !phone_number || !full_name || !age || !location || !school_name || !status || !subtype_id) {
    return res.status(400).json({ message: 'All required fields must be filled' });
  }

  // Ensure subtype_id is a single value (avoid array)
  const subtypeIdSingle = Array.isArray(subtype_id) ? subtype_id[0] : subtype_id;

  // Handle uploaded image
  let image_path = null;
  if (req.file) {
    image_path = `/uploads/${req.file.filename}`;
  }

  // Build dynamic query
  const query = image_path
    ? `UPDATE reports
       SET description = ?, phone_number = ?, full_name = ?, age = ?, location = ?, school_name = ?, status = ?, reason = ?, subtype_id = ?, image_path = ?, updated_at = NOW()
       WHERE case_number = ?`
    : `UPDATE reports
       SET description = ?, phone_number = ?, full_name = ?, age = ?, location = ?, school_name = ?, status = ?, reason = ?, subtype_id = ?, updated_at = NOW()
       WHERE case_number = ?`;

  const values = image_path
    ? [description, phone_number, full_name, age, location, school_name, status, reason || null, subtypeIdSingle, image_path, case_number]
    : [description, phone_number, full_name, age, location, school_name, status, reason || null, subtypeIdSingle, case_number];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
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
            await sendStatusEmail(reporter_email, full_name, case_number, status, reason);
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