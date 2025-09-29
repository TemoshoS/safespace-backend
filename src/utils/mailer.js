// require('dotenv').config(); 
// const nodemailer = require('nodemailer');

// const transporter = nodemailer.createTransport({
//     service: 'Gmail',
//     auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS
//     }
// });

// function sendVerificationEmail(to, code) {
//     const mailOptions = {
//         from: process.env.EMAIL_USER,
//         to,
//         subject: 'Admin Verification Code',
//         text: `Your verification code is: ${code}`
//     };

//     return transporter.sendMail(mailOptions);
// }

// module.exports = { sendVerificationEmail };

require('dotenv').config(); 
const nodemailer = require('nodemailer');

function sendVerificationEmail(to, code) {
    // Check if email credentials are available
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('══════════════════════════════════════');
        console.log('📧 DEVELOPMENT MODE - EMAIL NOT SENT');
        console.log('══════════════════════════════════════');
        console.log('To:', to);
        console.log('Verification Code:', code);
        console.log('══════════════════════════════════════');
        console.log('💡 To enable real emails, add to .env:');
        console.log('   EMAIL_USER=your_email@gmail.com');
        console.log('   EMAIL_PASS=your_app_password');
        console.log('══════════════════════════════════════');
        
        // Simulate success without sending email
        return Promise.resolve({ 
            success: true, 
            message: 'Code logged to console for development',
            code: code 
        });
    }

    // If credentials exist, send real email
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: 'Admin Verification Code',
        text: `Your verification code is: ${code}`
    };

    return transporter.sendMail(mailOptions);
}

module.exports = { sendVerificationEmail };