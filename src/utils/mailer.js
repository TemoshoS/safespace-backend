require('dotenv').config();
const nodemailer = require('nodemailer');

// Create transporter for cPanel email
const transporter = nodemailer.createTransport({
  host: 'mail.teketesafespace.co.za',
  port: 465,
  secure: true, // true for port 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  authMethod: 'LOGIN',
  tls: {
    rejectUnauthorized: false
  }
});



// ✅ Report confirmation email 
function sendReportConfirmation(to, fullName, caseNumber) {
  const mailOptions = {
    from: `"SafeSpace Support" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'SafeSpace - Report Confirmation',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>SafeSpace Report Confirmation</title>
        <style>
          body {
            background-color: #f4f4f4;
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            padding: 0;
            color: #333;
          }
          .container {
            max-width: 600px;
            background-color: #ffffff;
            margin: 20px auto;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 0 10px rgba(0,0,0,0.05);
          }
          .header {
            background-color: #ffffff;
            padding: 20px;
            text-align: center;
          }
          .header h2 {
            color: #168a1cff;
            margin: 0;
          }
          .content {
            padding: 20px;
            font-size: 16px;
            line-height: 1.6;
          }
          .case-box {
            background-color: #f0f0f0;
            color: #007bff;
            font-size: 20px;
            font-weight: bold;
            padding: 12px;
            border-radius: 6px;
            text-align: center;
            margin: 20px 0;
          }
          .footer {
            background-color: #f8f8f8;
            text-align: center;
            padding: 10px;
            font-size: 13px;
            color: #666;
          }
          @media (max-width: 480px) {
            .content {
              font-size: 15px;
              padding: 15px;
            }
            .case-box {
              font-size: 18px;
              padding: 10px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Thank You for Your Report</h2>
          </div>
          <div class="content">
            <p>This email is to confirm that we have received your incident report.</p>
            <p>Your unique case number is:</p>
            <div class="case-box">${caseNumber}</div>
            <p>Please keep this number safe for future reference. We will use it to track your case and provide updates.</p>
            <p>We appreciate you taking the time to report this case. We are committed to ensuring the safety and well-being of our community.</p>
            <p style="font-size: 12px; color: #686767ff;">This is an automated email. Please do not reply.</p>
          </div>
          <div class="footer">
            © 2025 Safe Space from Moepi Publishing
          </div>
        </div>
      </body>
      </html>
    `
  };

  return transporter.sendMail(mailOptions);
}



// ✅ Notify Admin of new report 
function sendAdminNewReportNotification(adminEmail, fullName, caseNumber, location, submittedAt) {
  const mailOptions = {
    from: `"Safespace" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `New Report Submitted: ${caseNumber}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Report Submitted</title>
        <style>
          body {
            background-color: #f6f8fb;
            font-family: 'Segoe UI', Roboto, Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #1f2937;
          }
          .container {
            max-width: 600px;
            background-color: #ffffff;
            margin: 40px auto;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          }
          .header {
            background-color: #f1f3f6;
            text-align: center;
            padding: 15px;
            font-weight: bold;
            color: #1f2937;
            font-size: 20px;
          }
          .content {
            padding: 30px 40px;
            color: #374151;
            font-size: 15px;
            line-height: 1.6;
          }
          .content h2 {
            color: #111827;
            margin-bottom: 10px;
          }
          .content p {
            margin: 8px 0;
          }
          .label {
            font-weight: 600;
            color: #111827;
          }
          .button {
            display: inline-block;
            background-color: #1f2937;
            color: #ffffff !important;
            text-decoration: none;
            font-weight: 600;
            padding: 12px 28px;
            border-radius: 6px;
            margin: 25px 0;
          }
          .footer {
            background-color: #f9fafb;
            text-align: left;
            padding: 20px 40px;
            font-size: 14px;
            color: #6b7280;
          }
          @media (max-width: 480px) {
            .content {
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            Safe_space
          </div>
          <div class="content">
            <h2>New Report Submitted</h2>
            <p>A reporter has submitted a <strong>new report</strong>.</p>
            
            <p><span class="label">Case Number:</span> ${caseNumber}</p>
            <p><span class="label">Location:</span> ${location || 'Not provided'}</p>
            <p><span class="label">Submitted At:</span> ${submittedAt || new Date().toLocaleString()}</p>
            <p><span class="label">Reporter:</span> ${fullName || 'Anonymous'}</p>

            <a href="https://staging.teketesafespace.co.za/school-admin" class="button">View Report</a>
          </div>
          <div class="footer">
            <p>Thanks,<br>Safe_space</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  return transporter.sendMail(mailOptions);
}


module.exports = { 
  sendReportConfirmation, 
  sendAdminNewReportNotification 
};
