require('dotenv').config(); 
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Admin login verification code
function sendVerificationEmail(to, code) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: 'SafeSpace Admin Login Code',
        html: `
            <p>Hello,</p>
            <p>You are attempting to log in as an admin to SafeSpace.</p>
            <p>Your verification code is: <strong>${code}</strong></p>
            <p>This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
            <p>Stay safe,</p>
            <p><em>SafeSpace Team</em></p>
        `
    };

    return transporter.sendMail(mailOptions);
}

// Forgot password / reset code
function sendResetCode(to, code) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: 'SafeSpace Password Reset Code',
        html: `
            <p>Hello,</p>
            <p>We received a request to reset your SafeSpace password.</p>
            <p>Your reset verification code is: <strong>${code}</strong></p>
            <p>Use this code to set a new password. It expires in 1 hour.</p>
            <p>If you did not request a password reset, please ignore this email.</p>
            <p>Thank you,</p>
            <p><em>SafeSpace Team</em></p>
        `
    };

    return transporter.sendMail(mailOptions);
}

//user status changed
function sendStatusEmail(to,fullName, caseNumber, status,reason) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: `SafeSpace Report Update - Case #${caseNumber}`,
        html: `
            <p>Hello, #${fullName}</p>
            <p>The status of your report <strong>Case #${caseNumber}</strong> has been updated.</p>
            <p>New Status: <strong>${status}</strong></p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p>Stay safe,</p>
            <p><em>SafeSpace Team</em></p>
        `
    };

    return transporter.sendMail(mailOptions);
}

module.exports = { sendVerificationEmail, sendResetCode,sendStatusEmail };
