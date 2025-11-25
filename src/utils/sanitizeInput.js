// utils/sanitizeInput.js

const SQLI_PATTERNS = [
    /(--|#|\/\*)/i,
    /\b(OR|AND)\b\s+\d+=\d+/i,
    /\bUNION\b\s+SELECT\b/i,
    /\bSELECT\b.*\bFROM\b/i,
    /\bINSERT\b\s+INTO\b/i,
    /\bUPDATE\b\s+\w+/i,
    /\bDELETE\b\s+FROM\b/i,
    /\bDROP\b\s+TABLE\b/i,
    /\bALTER\b\s+TABLE\b/i,
    /\bSLEEP\s*\(/i,
    /\bBENCHMARK\s*\(/i,
    /0x[0-9A-F]+/i,
    /\bLOAD_FILE\b/i,
    /\bOUTFILE\b/i,
    /['"`]\s*(OR|AND)\s*['"`]/i
];

function isMaliciousInput(value) {
    if (!value || typeof value !== "string") return false;

    const input = value.trim();
    return SQLI_PATTERNS.some((regex) => regex.test(input));
}

function cleanInput(value) {
    if (typeof value !== "string") return value;
    return value.replace(/[^\w\s.,!?@#\-]/g, "");
}

module.exports = { isMaliciousInput, cleanInput };
