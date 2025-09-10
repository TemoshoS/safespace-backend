const nodemailer = require('nodemailer');


const transporter = nodemailer.createTransport({
    service: 'Gmail', 
    auth: {
        user: '@gmail.com',
        pass: 'your-email-password-or-app-password'
    }
});

function sendVerificationEmail(to, code) {
    const mailOptions = {
        from: '@gmail.com',
        to,
        subject: 'Admin Verification Code',
        text: `Your verification code is: ${code}`
    };

    return transporter.sendMail(mailOptions);
}

module.exports = { sendVerificationEmail };
