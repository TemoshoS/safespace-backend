// database.js
const mysql = require('mysql2');

// MySQL connection setup
// const db = mysql.createConnection({
//     host: 'localhost',
//     user:  'root',
//     password: '',
//     database: 'safespace'
// });



const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // XAMPP usually has empty password
    database: 'safespace'
});


// Connect & check
db.connect((err) => {
    if (err) {
        console.error('MySQL connection failed:', err.message);
    } else {
        console.log('Connected to MySQL database');
    }
});

// Export the connection
module.exports = db;