const { isMaliciousInput, cleanInput } = require("../utils/sanitizeInput");

function validateRequest(req, res, next) {
    try {
        const all = { ...req.body, ...req.query, ...req.params };

        for (const key in all) {
            const value = all[key];

            if (typeof value === "string") {
                if (isMaliciousInput(value)) {
                    return res.status(403).json({
                        message: "Access denied: Malicious input detected"
                    });
                }

                // Clean safe characters only
                all[key] = cleanInput(value);
            }
        }

        req.body = all;
        next();
    } catch (err) {
        res.status(500).json({ message: "Internal security error" });
    }
}

module.exports = validateRequest;
