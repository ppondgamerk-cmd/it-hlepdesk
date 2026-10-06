const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 8282;

// Middleware
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (req.path.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-store');
        const origin = req.headers.origin;
        const publicOrigins = (process.env.APP_ORIGIN || '').split(',').map(value => value.trim()).filter(Boolean);
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin && origin !== `${req.protocol}://${req.get('host')}` && !publicOrigins.includes(origin)) return res.status(403).json({ error: 'แหล่งที่มาของคำขอไม่ถูกต้อง' });
    }
    next();
});
app.use(express.json({ limit: '3mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
const authRoutes = require('./routes/authRoutes');
const ticketRoutes = require('./routes/ticketRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api', (req, res) => res.status(404).json({ error: 'ไม่พบ API ที่ร้องขอ' }));
app.use((error, req, res, next) => {
    console.error('Request failed:', error.message);
    res.status(error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500).json({ error: error.type === 'entity.too.large' ? 'ข้อมูลมีขนาดใหญ่เกินกำหนด' : error.type === 'entity.parse.failed' ? 'รูปแบบข้อมูลไม่ถูกต้อง' : 'ระบบขัดข้อง กรุณาลองใหม่หรือติดต่อผู้ดูแล' });
});

// Redirect root to login.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start Server locally if not running on Vercel
if (require.main === module && !process.env.VERCEL) {
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
