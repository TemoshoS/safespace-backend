require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// 1️⃣ Admin login verification email
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

// 2️⃣ Forgot password / reset email
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

// 3️⃣ Report status update email
function sendStatusEmail(to, fullName, caseNumber, status, reason) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: `SafeSpace Report Update - Case #${caseNumber}`,
        html: `
            <p>Hello, ${fullName || 'User'},</p>
            <p>The status of your report <strong>Case #${caseNumber}</strong> has been updated.</p>
            <p>New Status: <strong>${status}</strong></p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p>Stay safe,</p>
            <p><em>SafeSpace Team</em></p>
        `
    };

    return transporter.sendMail(mailOptions);
}

// 4️⃣ Report confirmation email
function sendReportConfirmation(to, fullName, caseNumber) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: 'SafeSpace - Report Confirmation',
        html: `
            <p>Hello, ${fullName || 'User'},</p>
            <p>Your report has been created successfully!</p>
            <p>Case Number: <strong>${caseNumber}</strong></p>
            <p>Thank you for taking the time to report this issue. Our team will review it shortly.</p>
            <p>Stay safe,</p>
            <p><em>SafeSpace Team</em></p>
        `
    };

    return transporter.sendMail(mailOptions);
}

// 5️⃣ Notify Admin of new report
function sendAdminNewReportNotification(adminEmail, fullName, caseNumber, abuseTypeName, subtypeName) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: adminEmail,
        subject: `🛑 New Report Submitted - Case #${caseNumber}`,
        html: `
            <p>Hello Admin,</p>
            <p>A new report has just been submitted on SafeSpace.</p>
            <p><strong>Case Number:</strong> ${caseNumber}</p>
            <p><strong>Reporter:</strong> ${fullName || 'Anonymous'}</p>
            <p><strong>Abuse Type:</strong> ${abuseTypeName || 'Unknown'}</p>
            <p><strong>Subtype:</strong> ${subtypeName || 'N/A'}</p>
            <p>Please log in to your admin dashboard to review this report.</p>
            <p>Stay safe,</p>
            <p><em>SafeSpace System</em></p>
        `
    };

    return transporter.sendMail(mailOptions);
}

module.exports = { 
    sendVerificationEmail, 
    sendResetCode, 
    sendStatusEmail,
    sendReportConfirmation,
    sendAdminNewReportNotification
};
