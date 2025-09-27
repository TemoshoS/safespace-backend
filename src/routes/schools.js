const express = require('express');
const router = express.Router();
const db = require('../database'); // use same db connection

// Search schools by query
router.get('/search', (req, res) => {
  const query = req.query.q || '';
  if (!query) return res.json([]);

  db.query(
    'SELECT id, name FROM schools WHERE name LIKE ? LIMIT 10',
    [`%${query}%`],
    (err, results) => {
      if (err) {
        console.error('Error searching schools:', err);
        return res.status(500).json({ error: 'Server error' });
      }
      res.json(results);
    }
  );
});

module.exports = router;
