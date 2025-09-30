const express = require('express');
const router = express.Router();
const db = require('../database'); 
const verifyAdmin = require('../middleware/auth');
const { sendStatusEmail } = require('../utils/mailer');


// GET all abuse reports with type and subtype names
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
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});




// PATCH abuse report status + send email
router.patch('/:id', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) return res.status(400).json({ message: 'Status is required' });

  // Update report
  db.query(
    'UPDATE reports SET status = ? WHERE id = ?',
    [status, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: err.message });

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Report not found' });
      }

      // Fetch reporter email + case number
      db.query(
        'SELECT full_name, reporter_email, case_number FROM reports WHERE id = ?',
        [id],
        async (err2, rows) => {
          if (err2 || rows.length === 0) {
            return res.json({ message: 'Status updated but email not sent' });
          }

          const { reporter_email,full_name, case_number } = rows[0];

          try {
           await sendStatusEmail(reporter_email, full_name, case_number, status);

            res.json({ message: 'Status updated and email sent' });
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
