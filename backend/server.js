const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 8282;

// Middleware
app.use(express.json({ limit: '10mb' })); // Allow larger Base64 payloads
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
const authRoutes = require('./routes/authRoutes');
const ticketRoutes = require('./routes/ticketRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);

// Redirect root to login.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start Server locally if not running on Vercel
if (!process.env.VERCEL) {
    const server = app.listen(PORT, () => {
        console.log(`=================================================`);
        console.log(` IT Helpdesk System runs at http://localhost:${PORT}`);
        console.log(`=================================================`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`=================================================`);
            console.error(` ERROR: Port ${PORT} is already in use by another process.`);
            console.error(` Please terminate the process on port ${PORT} or choose a different port.`);
            console.error(`=================================================`);
            process.exit(1);
        } else {
            console.error("Server error:", err);
        }
    });
}

// Export app for Vercel Serverless Functions
module.exports = app;
