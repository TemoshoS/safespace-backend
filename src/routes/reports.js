const express = require('express');
const router = express.Router();
const db = require('../database');
const { sendReportConfirmation, sendAdminNewReportNotification } = require('../utils/mailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

/* ------------------------------------------------------------------
   🚨 STRICT SQL INJECTION BLOCKER
------------------------------------------------------------------ */
const hasSQLi = (value) => {
  if (typeof value !== "string") return false;

  const patterns = [
    /(\bdrop\b|\bdelete\b|\binsert\b|\bupdate\b|\balter\b|\btruncate\b)/i, // SQL keywords
    /(--|#|;)/,             // SQL comment + statement breakers
    /['"`]/                 // Quotes that may break queries
  ];

  return patterns.some((p) => p.test(value));
};

/* SAFER CLEAN FUNCTION */
const clean = (value) => {
  if (!value) return "";
  return value.replace(/[^A-Za-z0-9\s.,!?@\-]/g, "");
};

/* Keep params extremely clean */
const cleanParam = (value) => value.replace(/[^A-Za-z0-9\-]/g, '');

/* ------------------------------------------------------------------
   📁 SAFE MULTER UPLOAD
------------------------------------------------------------------ */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir))
      fs.mkdirSync(uploadsDir, { recursive: true });

    cb(null, uploadsDir);
  },

  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^A-Za-z0-9.\-_]/g, '');
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `report-${unique}-${cleanName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

/* ------------------------------------------------------------------
   🔢 CASE NUMBER GENERATION
------------------------------------------------------------------ */
const abuseTypeMap = {
  1: 'BU', 2: 'SB', 3: 'SX', 4: 'TP', 5: 'WP', 6: 'VL'
};

const generateCaseNumber = async (abuse_type_id) => {
  const prefix = abuseTypeMap[abuse_type_id] || 'XX';
  const [rows] = await db.execute(
    'SELECT MAX(id) AS max_id FROM reports WHERE abuse_type_id = ?',
    [abuse_type_id]
  );

  const nextNum = (rows[0].max_id || 0) + 1;
  const formatted = nextNum.toString().padStart(4, '0');

  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');

  return `CASE-${prefix}${formatted}${day}${month}`;
};

/* ------------------------------------------------------------------
   📝 CREATE REPORT (SECURED)
------------------------------------------------------------------ */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    // 🚨 Check for SQL Injection Before Anything
    for (const [key, value] of Object.entries(req.body)) {
      if (hasSQLi(value)) {
        return res.status(403).json({
          message: "Access denied: Malicious input detected"
        });
      }
    }

    // Clean all inputs
    const body = Object.fromEntries(
      Object.entries(req.body).map(([k, v]) => [k, v ? clean(v) : null])
    );

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
    } = body;

    // Required fields validation
    if (!abuse_type_id || !phone_number ||!age || !location || !school_name) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const file_path = req.file ? `/uploads/${req.file.filename}` : null;
    const case_number = await generateCaseNumber(abuse_type_id);

    const query = `
      INSERT INTO reports
      (abuse_type_id, subtype_id, description, reporter_email, phone_number,
       full_name, age, location, grade, school_name, case_number, status,
       is_anonymous, image_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const values = [
      abuse_type_id,
      subtype_id ?? null,
      description,
      reporter_email ?? null,
      phone_number,
      full_name ?? null,
      age,
      location,
      grade ?? null,
      school_name,
      case_number,
      status,
      is_anonymous,
      file_path
    ];

    const [result] = await db.execute(query, values);

    // Email reporter
    if (reporter_email) {
      sendReportConfirmation(reporter_email, full_name, case_number).catch(console.error);
    }

    // Notify school admins
    const [admins] = await db.execute(
      `SELECT email, name FROM users WHERE role = 'school' AND school_name = ?`,
      [school_name]
    );

    const submittedAt = new Date().toLocaleString();

    admins.forEach(admin => {
      sendAdminNewReportNotification(admin.email, full_name, case_number, location, submittedAt);
    });

    res.status(201).json({
      message: "Report created successfully",
      reportId: result.insertId,
      case_number
    });

  } catch (error) {
    console.error("Report error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/* ------------------------------------------------------------------
   🔍 GET SINGLE REPORT
------------------------------------------------------------------ */
router.get('/case/:case_number', async (req, res) => {
  try {
    const case_number = cleanParam(req.params.case_number);

    const [results] = await db.execute(
      `SELECT reports.*, abuse_types.type_name AS abuse_type,
              subtypes.sub_type_name AS subtype
       FROM reports
       LEFT JOIN abuse_types ON reports.abuse_type_id = abuse_types.id
       LEFT JOIN subtypes ON reports.subtype_id = subtypes.id
       WHERE reports.case_number = ?`,
      [case_number]
    );

    if (!results.length) {
      return res.status(404).json({ message: "Case not found" });
    }

    res.json(results[0]);

  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/* ------------------------------------------------------------------
   📌 GET SUBTYPES
------------------------------------------------------------------ */
router.get('/subtypes/:abuse_type_id', async (req, res) => {
  try {
    const id = cleanParam(req.params.abuse_type_id);
    const [results] = await db.execute(
      "SELECT id, sub_type_name FROM subtypes WHERE abuse_type_id = ?",
      [id]
    );

    res.json(results);

  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/* ------------------------------------------------------------------
   ✏️ UPDATE REPORT
------------------------------------------------------------------ */
router.put('/:case_number', upload.single('file'), async (req, res) => {
  try {
    const case_number = cleanParam(req.params.case_number);

    const body = Object.fromEntries(
      Object.entries(req.body).map(([k, v]) => [k, v ? clean(v) : null])
    );

    const {
      description, phone_number, full_name,
      age, location, school_name, status,
      subtype_id, grade
    } = body;

    if (!description || !phone_number || !full_name || !age ||
      !location || !school_name || !status || !subtype_id || !grade) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const media_path = req.file ? `/uploads/${req.file.filename}` : null;

    const query = media_path
      ? `UPDATE reports SET description=?, phone_number=?, full_name=?, age=?, location=?, 
         school_name=?, status=?, subtype_id=?, image_path=?, grade=?, updated_at=NOW()
         WHERE case_number=?`
      : `UPDATE reports SET description=?, phone_number=?, full_name=?, age=?, location=?, 
         school_name=?, status=?, subtype_id=?, grade=?, updated_at=NOW()
         WHERE case_number=?`;

    const values = media_path
      ? [description, phone_number, full_name, age, location, school_name, status,
         subtype_id, media_path, grade, case_number]
      : [description, phone_number, full_name, age, location, school_name, status,
         subtype_id, grade, case_number];

    const [result] = await db.execute(query, values);

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.json({ message: "Report updated successfully", case_number });

  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
