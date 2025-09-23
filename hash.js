// hash.js
const bcrypt = require('bcryptjs');

const password = process.argv[2]; // get password from command line
if (!password) {
    console.log('Usage: node hash.js <password>');
    process.exit(1);
}

const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) throw err;
    console.log('Hashed password:', hash);
});
