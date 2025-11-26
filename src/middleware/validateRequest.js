// middleware/validateRequest.js
const { isMaliciousInput } = require("../utils/sanitizeInput");

function validateRequest(req, res, next) {
  const allInputs = { ...req.body, ...req.params, ...req.query };

  for (const [key, value] of Object.entries(allInputs)) {
    if (typeof value === "string" && isMaliciousInput(value)) {
      console.log("🚨 Blocked SQLi:", key, value);
      return res.status(403).json({
        message: "Access denied: Malicious input detected"
      });
    }
  }

  next();
}

module.exports = validateRequest;
