const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const abuseTypesRoutes = require('./src/routes/abuseTypes');
const adminRoutes = require('./src/routes/admin');
const statusCheckRouter = require('./src/routes/caseNumber');
const reportsRoutes = require('./src/routes/reports'); // reports table routes
const authRoutes = require('./src/middleware/auth');


const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/admin', adminRoutes);
app.use('/abuse_types', abuseTypesRoutes);
app.use('/reports', reportsRoutes);
app.use('/status-check', statusCheckRouter);
app.use('/abuse_reports', reportsRoutes); // optional alias
app.use('/auth', authRoutes);

// Optional alias for frontend convenience
app.use('/abuse_reports', reportsRoutes); // allows frontend code using /abuse_reports to still work

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
