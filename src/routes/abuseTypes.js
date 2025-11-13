const express = require('express');
const router = express.Router();
const db = require('../database'); // your promise pool

router.get('/', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM abuse_types'); // promise API
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
