const express = require('express');
const router = express.Router();
const db = require('../database');
const { sendReportConfirmation, sendAdminNewReportNotification } = require('../utils/mailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { clean, cleanParam, isMaliciousInput } = require('../utils/sanitizeInput');

/* -------------------------------
   MULTER (SAFE UPLOADS)
--------------------------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^A-Za-z0-9.\-_]/g, '');
    cb(null, `report-${Date.now()}-${cleanName}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 }});

/* -------------------------------
   CASE NUMBER GENERATION
--------------------------------- */
const abuseTypeMap = { 1: 'BU', 2: 'SB', 3: 'SX', 4: 'TP', 5: 'WP', 6: 'VL' };

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

/* -------------------------------
   HELPER: CHECK MALICIOUS INPUTS
--------------------------------- */
const checkMalicious = (obj) => {
  for (const [key, value] of Object.entries(obj)) {
    if (value && isMaliciousInput(value)) {
      return key;
    }
  }
  return null;
};

/* -------------------------------
   CREATE REPORT
--------------------------------- */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const body = Object.fromEntries(
      Object.entries(req.body).map(([k, v]) => [k, v ? clean(v) : null])
    );

    // Reject malicious inputs
    const badField = checkMalicious(body);
    if (badField) return res.status(403).json({ message: `Malicious input detected in field: ${badField}` });

    const {
      abuse_type_id, subtype_id, description, reporter_email,
      phone_number, full_name, age, location, grade, school_name,
      status = "Pending", is_anonymous = 0
    } = body;

    if (!abuse_type_id || !phone_number || !age || !location || !school_name) {
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
      abuse_type_id, subtype_id ?? null, description, reporter_email ?? null,
      phone_number, full_name ?? null, age, location, grade ?? null,
      school_name, case_number, status, is_anonymous, file_path
    ];

    const [result] = await db.execute(query, values);

    if (reporter_email)
      sendReportConfirmation(reporter_email, full_name, case_number);

    const [admins] = await db.execute(
      `SELECT email, name FROM users WHERE role = 'school' AND school_name = ?`,
      [school_name]
    );

    const submittedAt = new Date().toLocaleString();
    admins.forEach(a => {
      sendAdminNewReportNotification(a.email, full_name, case_number, location, submittedAt);
    });

    res.status(201).json({
      message: "Report created successfully",
      reportId: result.insertId,
      case_number
    });

  } catch (err) {
    console.error("Report error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------------------
   GET SUBTYPES
--------------------------------- */
router.get('/subtypes/:abuse_type_id', async (req, res) => {
  try {
    const abuse_type_id = cleanParam(req.params.abuse_type_id);
    if (isMaliciousInput(abuse_type_id)) return res.status(403).json({ message: "Malicious input detected" });

    const [results] = await db.execute(
      "SELECT id, sub_type_name FROM subtypes WHERE abuse_type_id = ?",
      [abuse_type_id]
    );
    res.json(results);

  } catch (err) {
    console.error("Subtypes error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/* -------------------------------
   GET SINGLE REPORT
--------------------------------- */
router.get('/case/:case_number', async (req, res) => {
  try {
    const rawCaseNumber = decodeURIComponent(req.params.case_number);

    // Reject if it looks like SQL injection or script tags
    const maliciousPattern = /(\b(SELECT|DROP|UNION|INSERT|UPDATE|DELETE|ALTER|TRUNCATE|EXEC|REPLACE|CREATE|SHOW|DESCRIBE|GRANT|REVOKE|LOCK|UNLOCK)\b|<script>|--|\/\*|\*\/|;|(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+|['"`])/i;

    if (maliciousPattern.test(rawCaseNumber)) {
      return res.status(403).json({ message: "Malicious input detected" });
    }

    // Sanitize after check
    const case_number = cleanParam(rawCaseNumber);

    const [results] = await db.execute(
      `SELECT reports.*, abuse_types.type_name AS abuse_type,
              subtypes.sub_type_name AS subtype
       FROM reports
       LEFT JOIN abuse_types ON reports.abuse_type_id = abuse_types.id
       LEFT JOIN subtypes ON reports.subtype_id = subtypes.id
       WHERE reports.case_number = ?`,
      [case_number]
    );

    if (!results.length) return res.status(404).json({ message: "Case not found" });
    res.json(results[0]);

  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});
/* -------------------------------
   UPDATE REPORT
--------------------------------- */
router.put('/:case_number', upload.single('file'), async (req, res) => {
  try {
    const case_number = cleanParam(req.params.case_number);
    if (isMaliciousInput(case_number)) return res.status(403).json({ message: "Malicious input detected" });

    const body = Object.fromEntries(
      Object.entries(req.body).map(([k, v]) => [k, v ? clean(v) : null])
    );

    const badField = checkMalicious(body);
    if (badField) return res.status(403).json({ message: `Malicious input detected in field: ${badField}` });

    const { description, phone_number, full_name, age,
      location, school_name, status, subtype_id, grade } = body;

    if (!description || !phone_number || !full_name || !age ||
        !location || !school_name || !status || !subtype_id || !grade) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const media_path = req.file ? `/uploads/${req.file.filename}` : null;

    const query = media_path
      ? `UPDATE reports SET description=?, phone_number=?, full_name=?, age=?, 
         location=?, school_name=?, status=?, subtype_id=?, image_path=?, grade=?, 
         updated_at=NOW() WHERE case_number=?`
      : `UPDATE reports SET description=?, phone_number=?, full_name=?, age=?, 
         location=?, school_name=?, status=?, subtype_id=?, grade=?, updated_at=NOW() 
         WHERE case_number=?`;

    const values = media_path
      ? [description, phone_number, full_name, age, location, school_name,
         status, subtype_id, media_path, grade, case_number]
      : [description, phone_number, full_name, age, location, school_name,
         status, subtype_id, grade, case_number];

    const [result] = await db.execute(query, values);
    if (!result.affectedRows) return res.status(404).json({ message: "Report not found" });

    res.json({ message: "Report updated successfully", case_number });

  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
