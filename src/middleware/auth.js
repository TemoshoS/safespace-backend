const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY || 'fallbacksecret';

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Invalid or expired token' });
        req.admin = decoded;
        next();
    });
}

module.exports = verifyToken;
