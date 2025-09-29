const express = require('express');
const router = express.Router();
const db = require('../database'); 
const verifyAdmin = require('../middleware/auth');


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



// PATCH abuse report status
router.patch('/:id', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) return res.status(400).json({ message: 'Status is required' });

  const query = 'UPDATE reports SET status = ? WHERE id = ?';
  db.query(query, [status, id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Report not found' });
    }

    res.json({ message: 'Status updated successfully' });
  });
});


module.exports = router; 
