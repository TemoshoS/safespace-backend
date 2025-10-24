const express = require('express');
const router = express.Router();
const db = require('../database');
const verifyAdmin = require('../middleware/auth');
const { sendStatusEmail, sendReportConfirmation } = require('../utils/mailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for image uploads
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
  limits: { fileSize: 15 * 1024 * 1024 } // max 15MB
});

// Map for case number prefixes
const abuseTypeMap = {
  1: "BU", // Bullying
  2: "SB", // Substance abuse
  3: "SX", // Sexual abuse
  4: "TP", // Theft/property
  5: "WP", // Workplace harassment
  6: "VL"  // Violence
};

// Generate case number (sequential + date-based)
const generateCaseNumber = async (abuse_type_id) => {
  return new Promise((resolve, reject) => {
    const prefix = abuseTypeMap[abuse_type_id] || "XX";

    // Step 1: Get current count of reports for this abuse type
    const countQuery = `SELECT COUNT(*) AS count FROM reports WHERE abuse_type_id = ?`;

    db.query(countQuery, [abuse_type_id], (err, results) => {
      if (err) return reject(err);

      const currentCount = results[0].count + 1; // Increment count
      const formattedCount = currentCount.toString().padStart(4, "0"); // 0001, 0002, etc.

      // Step 2: Get current day and month
      const now = new Date();
      const day = String(now.getDate()).padStart(2, "0");
      const month = String(now.getMonth() + 1).padStart(2, "0");

      // Step 3: Combine all parts
      const caseNumber = `CASE-${prefix}${formattedCount}${day}${month}`;
      resolve(caseNumber);
    });
  });
};


// 🟢 Create a new report
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
      grade,
      school_name,
      status = 'Pending',
      is_anonymous = 0,
      image_base64,
      image_filename
    } = req.body;

    // 🟡 Fetch the subtype name to check if it's "Other"
    let subtypeName = null;
    if (subtype_id) {
      const subtypeQuery = 'SELECT sub_type_name FROM subtypes WHERE id = ? LIMIT 1';
      const [subtypeResult] = await new Promise((resolve, reject) => {
        db.query(subtypeQuery, [subtype_id], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      subtypeName = subtypeResult ? subtypeResult.sub_type_name : null;
    }

    // 🟡 Validation Rule:
    // - abuse_type_id required
    // - reporter_email required only if not anonymous
    // - description required only if subtype is "Other"
    if (
      !abuse_type_id ||
      (!is_anonymous && !reporter_email) ||
      (subtypeName === 'Other' && !description)
    ) {
      return res.status(400).json({ message: 'Required fields are missing.' });
    }

    // Handle image uploads (base64 or file)
    let image_path = null;

    if (image_base64) {
      try {
        const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const filename = image_filename || `report-${Date.now()}.jpg`;
        const filepath = path.join(__dirname, '../../uploads', filename);

        const uploadsDir = path.dirname(filepath);
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        fs.writeFileSync(filepath, imageBuffer);
        image_path = `/uploads/${filename}`;
      } catch (error) {
        console.error('❌ Error saving base64 image:', error);
      }
    } else if (req.file) {
      image_path = `/uploads/${req.file.filename}`;
    }

    const case_number = await generateCaseNumber(abuse_type_id);

    const query = `
      INSERT INTO reports
      (abuse_type_id, subtype_id, description, reporter_email, phone_number, full_name, age, location, grade, school_name, case_number, status, is_anonymous, image_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
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
      grade,
      school_name,
      case_number,
      status,
      is_anonymous,
      image_path
    ];

    db.query(query, values, async (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
      }

      // Send confirmation email (if reporter email exists)
      if (reporter_email) {
        try {
          await sendReportConfirmation(reporter_email, full_name, case_number);
        } catch (e) {
          console.error('Error sending confirmation email:', e);
        }
      }

      res.status(201).json({
        message: 'Report created successfully',
        reportId: result.insertId,
        case_number
      });
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// 🟢 Get all reports (admin)
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





// 🟢 Get single report by case number
router.get('/case/:case_number', (req, res) => {
  const { case_number } = req.params;
  if (!case_number) return res.status(400).json({ message: 'Case number required' });

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

// 🟢 Get subtypes by abuse type
router.get('/subtypes/:abuse_type_id', (req, res) => {
  const { abuse_type_id } = req.params;
  const query = 'SELECT id, sub_type_name FROM subtypes WHERE abuse_type_id = ?';
  db.query(query, [abuse_type_id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    res.json(results);
  });
});

// 🟢 Update report details
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

  const subtypeIdSingle = Array.isArray(subtype_id) ? subtype_id[0] : subtype_id;

  let image_path = null;
  if (req.file) {
    image_path = `/uploads/${req.file.filename}`;
  }

  const query = image_path
    ? `UPDATE reports SET description=?, phone_number=?, full_name=?, age=?, location=?, school_name=?, status=?, reason=?, subtype_id=?, image_path=?, updated_at=NOW() WHERE case_number=?`
    : `UPDATE reports SET description=?, phone_number=?, full_name=?, age=?, location=?, school_name=?, status=?, reason=?, subtype_id=?, updated_at=NOW() WHERE case_number=?`;

  const values = image_path
    ? [description, phone_number, full_name, age, location, school_name, status, reason || null, subtypeIdSingle, image_path, case_number]
    : [description, phone_number, full_name, age, location, school_name, status, reason || null, subtypeIdSingle, case_number];

  db.query(query, values, (err, result) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Report not found' });
    res.json({ message: 'Report updated successfully', case_number });
  });
});

// 🟢 Update status & send email
router.patch('/:id', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!status || !reason) return res.status(400).json({ message: 'Status and reason are required' });

  db.query(
    'UPDATE reports SET status = ?, reason = ?, updated_at = NOW() WHERE id = ?',
    [status, reason, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Server error', error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Report not found' });

      db.query('SELECT reporter_email, full_name, case_number FROM reports WHERE id = ?', [id], async (err2, rows) => {
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
      });
    }
  );
});

module.exports = router;
