const express = require('express');
const router = express.Router();
const db = require('../database'); // promise pool

// GET status by case_number
router.get('/:case_number', async (req, res) => {
  try {
    const { case_number } = req.params;

    if (!case_number) {
      return res.status(400).json({ message: 'Reference number is required' });
    }

    const query = 'SELECT case_number, status FROM abuse_reports WHERE case_number = ?';
    const [results] = await db.query(query, [case_number]);

    if (results.length === 0) {
      return res.status(404).json({ message: 'Reference number not found' });
    }

    return res.status(200).json(results[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
