const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const abuseTypesRoutes = require('./src/routes/abuseTypes');
const adminRoutes = require('./src/routes/admin');
const adminHome = require('./src/routes/adminHome');
const adminProfileRoutes = require('./src/routes/adminProfile');
const statusCheckRouter = require('./src/routes/caseNumber');
const reportsRoutes = require('./src/routes/reports'); // reports table routes
const authRoutes = require('./src/middleware/auth');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// ✅ Register routes
app.use('/admin', adminRoutes);
app.use('/abuse_types', abuseTypesRoutes);
app.use('/abuse_reports', reportsRoutes); // abuse reports endpoint
app.use('/admin-home', adminHome);
app.use('/admin-profile', adminProfileRoutes);
app.use('/status-check', statusCheckRouter);
app.use('/auth', authRoutes);

// ✅ Optional alias for frontend convenience
app.use('/reports', reportsRoutes); // allows frontend code using /reports to still work

// ✅ Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
