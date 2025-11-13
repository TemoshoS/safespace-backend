const express = require('express');
const router = express.Router();
const db = require('../database'); // your promise pool

router.get('/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    if (!query.trim()) return res.json([]);

    const sql = `
      SELECT emis_no AS id, school_name AS name
      FROM schools
      WHERE school_name LIKE ?
      ORDER BY school_name ASC
      LIMIT 10
    `;

    const [results] = await db.query(sql, [`%${query}%`]); // promise-style
    res.json(results);

  } catch (err) {
    console.error('DB Query Error:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

module.exports = router;
