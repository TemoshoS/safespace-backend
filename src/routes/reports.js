const express = require('express');
const router = express.Router();
const db = require('../database');
const verifyAdmin = require('../middleware/auth');
const { sendStatusEmail, sendReportConfirmation } = require('../utils/mailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// -------------------- Multer Setup --------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `report-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 50MB max
});

// -------------------- Case Number Generation --------------------
const abuseTypeMap = {
  1: "BU",
  2: "SB",
  3: "SX",
  4: "TP",
  5: "WP",
  6: "VL"
};

const generateCaseNumber = async (abuse_type_id) => {
  return new Promise((resolve, reject) => {
    const prefix = abuseTypeMap[abuse_type_id] || "XX";
    const countQuery = `SELECT COUNT(*) AS count FROM reports WHERE abuse_type_id = ?`;

    db.query(countQuery, [abuse_type_id], (err, results) => {
      if (err) return reject(err);
      const currentCount = results[0].count + 1;
      const formattedCount = currentCount.toString().padStart(4, "0");
      const now = new Date();
      const day = String(now.getDate()).padStart(2, "0");
      const month = String(now.getMonth() + 1).padStart(2, "0");
      resolve(`CASE-${prefix}${formattedCount}${day}${month}`);
    });
  });
};

// -------------------- Create Report --------------------
router.post('/', (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.startsWith('multipart/form-data')) {
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.message });
      next();
    });
  } else {
    next();
  }
}, async (req, res) => {
  try {
    const {
      abuse_type_id, subtype_id, description, reporter_email,
      phone_number, full_name, age, location, grade, school_name,
      status = 'Pending', is_anonymous = 0, file_base64, file_filename
    } = req.body;

    if (!abuse_type_id) return res.status(400).json({ message: 'Abuse type is required' });

    let file_path = null;

    // Handle Base64 file
    if (file_base64) {
      const base64Data = file_base64.replace(/^data:(image|video)\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = file_filename || `report-${Date.now()}.bin`;
      const filepath = path.join(__dirname, '../../uploads', filename);

      if (!fs.existsSync(path.dirname(filepath))) {
        fs.mkdirSync(path.dirname(filepath), { recursive: true });
      }
      fs.writeFileSync(filepath, buffer);
      file_path = `/uploads/${filename}`;
    } else if (req.file) {
      file_path = `/uploads/${req.file.filename}`;
    }

    const case_number = await generateCaseNumber(abuse_type_id);

    const query = `
      INSERT INTO reports
      (abuse_type_id, subtype_id, description, reporter_email, phone_number, full_name, age, location, grade, school_name, case_number, status, is_anonymous, image_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const values = [
      abuse_type_id, subtype_id, description, reporter_email, phone_number,
      full_name, age, location, grade, school_name, case_number, status,
      is_anonymous, file_path
    ];

    db.query(query, values, async (err, result) => {
      if (err) return res.status(500).json({ message: 'Server error', error: err.message });

      if (reporter_email) {
        try {
          await sendReportConfirmation(reporter_email, full_name, case_number);
        } catch (e) {
          console.error('Email send error:', e);
        }
      }

      res.status(201).json({ message: 'Report created successfully', reportId: result.insertId, case_number });
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// -------------------- Get All Reports (Admin) --------------------
router.get('/', verifyAdmin, (req, res) => {
  const query = `
    SELECT reports.id, reports.case_number, reports.reporter_email,
           reports.phone_number, reports.description, reports.image_path,
           reports.created_at, reports.status, abuse_types.type_name AS abuse_type,
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

// -------------------- Get Single Report --------------------
router.get('/case/:case_number', (req, res) => {
  const { case_number } = req.params;
  if (!case_number) return res.status(400).json({ message: 'Case number required' });

  const query = `
    SELECT reports.*, abuse_types.type_name AS abuse_type, subtypes.sub_type_name AS subtype
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

// -------------------- Get Subtypes by Abuse Type --------------------
router.get('/subtypes/:abuse_type_id', (req, res) => {
  const { abuse_type_id } = req.params;
  const query = 'SELECT id, sub_type_name FROM subtypes WHERE abuse_type_id = ?';
  db.query(query, [abuse_type_id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    res.json(results);
  });
});

// ---------------- Update Report ----------------
router.put('/:case_number', upload.single('file'), (req, res) => {
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
    subtype_id,
    grade // ✅ new field
  } = req.body;

  if (!description || !phone_number || !age || !location || !school_name || !status || !subtype_id || !grade) {
    return res.status(400).json({ message: 'All required fields must be filled' });
  }

  const subtypeIdSingle = Array.isArray(subtype_id) ? subtype_id[0] : subtype_id;
  const media_path = req.file ? `/uploads/${req.file.filename}` : null;

  const query = media_path
    ? `UPDATE reports 
       SET description=?, phone_number=?, full_name=?, age=?, location=?, school_name=?, status=?, reason=?, subtype_id=?, image_path=?, grade=?, updated_at=NOW() 
       WHERE case_number=?`
    : `UPDATE reports 
       SET description=?, phone_number=?, full_name=?, age=?, location=?, school_name=?, status=?, reason=?, subtype_id=?, grade=?, updated_at=NOW() 
       WHERE case_number=?`;

  const values = media_path
    ? [description, phone_number, full_name, age, location, school_name, status, reason || null, subtypeIdSingle, media_path, grade, case_number]
    : [description, phone_number, full_name, age, location, school_name, status, reason || null, subtypeIdSingle, grade, case_number];

  db.query(query, values, (err, result) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Report not found' });

    res.json({ message: 'Report updated successfully', case_number });
  });
});



// -------------------- Update Status and Send Email --------------------
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
        if (err2 || rows.length === 0) return res.json({ message: 'Status updated but email not sent' });

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
