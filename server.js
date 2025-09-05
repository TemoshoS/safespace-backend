const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const abuseTypesRoutes = require('./src/routes/abuseTypes');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/abuse_types', abuseTypesRoutes); 


// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});