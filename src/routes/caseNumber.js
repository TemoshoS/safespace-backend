const express = require('express');
const router = express.Router();
const db = require('../database'); 

// GET status by case_number
router.get('/:case_number', (req, res) => {
  let { case_number } = req.params;

  if (!case_number) {
    return res.status(400).json({ message: 'Case number is required' });
  }

  // Trim whitespace to handle cases like "   "
  case_number = case_number.trim();

  // If whitespace-only was provided, return error
  if (case_number.length === 0) {
    return res.status(400).json({ message: 'Case number cannot be empty' });
  }

  const query = 'SELECT case_number, status FROM abuse_reports WHERE case_number = ?';
  db.query(query, [case_number], (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });

    if (results.length === 0) {
      return res.status(404).json({ message: 'Case not found' });
    }

    return res.status(200).json(results[0]);
  });
});

module.exports = router;
