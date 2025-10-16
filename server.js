const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// ✅ Increase JSON & URL-encoded body size limits
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// OR using express only (also works)
// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Create uploads folder if not exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

// Serve uploads folder publicly
app.use('/uploads', express.static(uploadDir));

// Middleware
app.use(cors());

// Routes
const abuseTypesRoutes = require('./src/routes/abuseTypes');
const adminRoutes = require('./src/routes/admin');
const adminHome = require('./src/routes/adminHome');
const adminProfileRoutes = require('./src/routes/adminProfile');
const statusCheckRouter = require('./src/routes/caseNumber');
const reportsRoutes = require('./src/routes/reports');
const schoolsRouter = require('./src/routes/schools');

app.use('/admin', adminRoutes);
app.use('/abuse_types', abuseTypesRoutes);
app.use('/abuse_reports', reportsRoutes);
app.use('/admin-profile', adminProfileRoutes);
app.use('/status-check', statusCheckRouter);
app.use('/reports', reportsRoutes);
app.use('/schools', schoolsRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
