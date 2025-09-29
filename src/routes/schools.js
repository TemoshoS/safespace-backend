const express = require('express');
const router = express.Router();
const db = require('../database'); // or your DB connection

router.get('/', (req, res) => {
  db.query("SELECT * FROM schools", (err, rows) => {
    if (err) {
      console.error('DB Error:', err);  // log the real error
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

module.exports = router;
