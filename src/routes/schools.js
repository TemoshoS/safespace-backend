const express = require('express');
const router = express.Router();
const db = require('../database'); // your DB connection

router.get('/search', (req, res) => {
    const query = req.query.q || '';
    if (!query.trim()) return res.json([]);

    const sql = `
        SELECT NatEmis AS id, Institution_Name AS name
        FROM schools
        WHERE Institution_Name LIKE ?
        ORDER BY Institution_Name ASC
        LIMIT 10
    `;

    db.query(sql, [`%${query}%`], (err, results) => {
        if (err) {
            console.error('DB Query Error:', err); 
            return res.status(500).json({ error: 'Database query failed' });
        }
        res.json(results);
    });
});

module.exports = router;
