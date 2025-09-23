const express = require('express');
const router = express.Router();
const db = require('../database'); 
const verifyAdmin = require('../middleware/auth');

// GET all abuse reports
router.get('/',verifyAdmin, (req, res) => {
    db.query('SELECT * FROM reports', (err, results) => {
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
