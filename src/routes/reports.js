const express = require('express');
const router = express.Router();
const db = require('../database');
const { sendReportConfirmation, sendAdminNewReportNotification } = require('../utils/mailer');
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
  const prefix = abuseTypeMap[abuse_type_id] || "XX";
  const [rows] = await db.query(`SELECT MAX(id) AS max_id FROM reports WHERE abuse_type_id = ?`, [abuse_type_id]);
  const nextNum = (rows[0].max_id || 0) + 1;
  const formattedCount = nextNum.toString().padStart(4, "0");
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `CASE-${prefix}${formattedCount}${day}${month}`;
};


// -------------------- Create Report --------------------
router.post('/', upload.single('file'), async (req, res) => {
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
      is_anonymous = 0
    } = req.body;

    if (!abuse_type_id) {
      return res.status(400).json({ message: 'Abuse type is required' });
    }

    let file_path = req.file ? `/uploads/${req.file.filename}` : null;
    const case_number = await generateCaseNumber(abuse_type_id);

    const query = `
      INSERT INTO reports
      (abuse_type_id, subtype_id, description, reporter_email, phone_number, full_name, age, location, grade, school_name, case_number, status, is_anonymous, image_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    const values = [
      abuse_type_id, subtype_id, description, reporter_email, phone_number,
      full_name, age, location, grade, school_name, case_number, status, is_anonymous, file_path
    ];
    const [result] = await db.query(query, values);

    // Send confirmation to the reporter
    if (reporter_email) {
      try {
        await sendReportConfirmation(reporter_email, full_name, case_number);
      } catch (e) {
        console.error('Reporter email send error:', e);
      }
    }


    // Notify only the admin(s) of the selected school
    try {
      const [admins] = await db.query(
        `SELECT email, name 
     FROM users 
     WHERE role = 'school' AND school_name = ?`,
        [school_name]
      );

      const submittedAt = new Date().toLocaleString(); // Format timestamp

      await Promise.all(admins.map(admin =>
        sendAdminNewReportNotification(
          admin.email,
          full_name,
          case_number,
          location,
          submittedAt
        )
      ));
    } catch (adminErr) {
      console.error('Admin notification error:', adminErr);
    }


    res.status(201).json({
      message: '✅ Report created successfully',
      reportId: result.insertId,
      case_number
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});


// -------------------- Get Single Report --------------------
router.get('/case/:case_number', async (req, res) => {
  try {
    const { case_number } = req.params;
    if (!case_number) return res.status(400).json({ message: 'Case number required' });

    const query = `
      SELECT reports.*, abuse_types.type_name AS abuse_type, subtypes.sub_type_name AS subtype
      FROM reports
      LEFT JOIN abuse_types ON reports.abuse_type_id = abuse_types.id
      LEFT JOIN subtypes ON reports.subtype_id = subtypes.id
      WHERE reports.case_number = ?
    `;

    const [results] = await db.query(query, [case_number]);

    if (results.length === 0) {
      return res.status(404).json({ message: 'Case not found' });
    }

    res.json(results[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


// -------------------- Get Subtypes by Abuse Type --------------------
router.get('/subtypes/:abuse_type_id', async (req, res) => {
  try {
    const { abuse_type_id } = req.params;
    const [results] = await db.query(
      'SELECT id, sub_type_name FROM subtypes WHERE abuse_type_id = ?',
      [abuse_type_id]
    );
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


// ---------------- Update Report ----------------
router.put('/:case_number', upload.single('file'), async (req, res) => {
  try {
    const { case_number } = req.params;
    const {
      description,
      phone_number,
      full_name,
      age,
      location,
      school_name,
      status,
      subtype_id,
      grade
    } = req.body;

    if (!phone_number || !age || !location || !school_name || !status || !subtype_id || !grade) {
      return res.status(400).json({ message: 'All required fields must be filled' });
    }

    const subtypeIdSingle = Array.isArray(subtype_id) ? subtype_id[0] : subtype_id;
    const media_path = req.file ? `/uploads/${req.file.filename}` : null;

    const query = media_path
      ? `UPDATE reports 
         SET description=?, phone_number=?, full_name=?, age=?, location=?, school_name=?, status=?, subtype_id=?, image_path=?, grade=?, updated_at=NOW() 
         WHERE case_number=?`
      : `UPDATE reports 
         SET description=?, phone_number=?, full_name=?, age=?, location=?, school_name=?, status=?, subtype_id=?, grade=?, updated_at=NOW() 
         WHERE case_number=?`;

    const values = media_path
      ? [description, phone_number, full_name, age, location, school_name, status, subtypeIdSingle, media_path, grade, case_number]
      : [description, phone_number, full_name, age, location, school_name, status, subtypeIdSingle, grade, case_number];

    const [result] = await db.query(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Report not found' });
    }

    res.json({ message: 'Report updated successfully', case_number });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});






module.exports = router;
