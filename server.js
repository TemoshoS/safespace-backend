const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const abuseTypesRoutes = require('./src/routes/abuseTypes');
const adminRoutes = require('./src/routes/admin');
const adminHome = require('./src/routes/adminHome');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/admin', adminRoutes);
app.use('/abuse_types', abuseTypesRoutes);
app.use('/abuse_reports', adminHome);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
