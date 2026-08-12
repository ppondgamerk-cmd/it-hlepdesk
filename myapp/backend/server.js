const express = require('express');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8282;

const DB_PATH = path.join(__dirname, 'data', 'tickets.json');
const USERS_PATH = path.join(__dirname, 'data', 'users.json');

// Initialize Supabase Client if credentials exist
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey) {
    try {
        supabase = createClient(supabaseUrl, supabaseKey);
        console.log("=================================================");
        console.log(" Successfully connected to Supabase Cloud Database!");
        console.log("=================================================");
    } catch (err) {
        console.error("Failed to initialize Supabase client:", err);
    }
} else {
    console.log("=================================================");
    console.log(" SUPABASE_URL & SUPABASE_KEY/SUPABASE_SECRET_KEY missing in Env.");
    console.log(" Running in Local JSON Database Fallback mode!");
    console.log("=================================================");
}

// Middleware
app.use(express.json({ limit: '10mb' })); // Allow larger Base64 payloads
app.use(express.static(path.join(__dirname, '../frontend')));

// --- Local Fallback Helpers ---
function readUsersLocal() {
    try {
        if (!fs.existsSync(USERS_PATH)) return [];
        const data = fs.readFileSync(USERS_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading users database:', err);
        return [];
    }
}

function readDatabaseLocal() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
            fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
            return [];
        }
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading database:', err);
        return [];
    }
}

function writeDatabaseLocal(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('Error writing database:', err);
    }
}

// --- API ENDPOINTS ---

// Login Endpoint
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน' });
    }

    try {
        let user;
        if (supabase) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username.trim())
                .eq('password', password.trim())
                .maybeSingle();

            if (error) {
                console.error("Supabase login select error:", error);
                return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล' });
            }
            user = data;
        } else {
            const users = readUsersLocal();
            user = users.find(u => u.username === username.trim() && u.password === password.trim());
        }

        if (!user) {
            return res.status(401).json({ error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
        }

        res.json({
            name: user.name,
            role: user.role,
            username: user.username,
            token: `mock-token-${user.role}-${Date.now()}`
        });
    } catch (err) {
        console.error("Login catch error:", err);
        res.status(500).json({ error: 'ระบบทำงานขัดข้อง' });
    }
});

// 1. Get all tickets
app.get('/api/tickets', async (req, res) => {
    try {
        if (supabase) {
            const { data, error } = await supabase
                .from('tickets')
                .select('*')
                .order('createdAt', { ascending: false });

            if (error) {
                console.error("Supabase tickets select error:", error);
                return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลตั๋วซ่อม' });
            }
            res.json(data || []);
        } else {
            const tickets = readDatabaseLocal();
            // Sort by creation date descending
            tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            res.json(tickets);
        }
    } catch (err) {
        console.error("Get tickets catch error:", err);
        res.status(500).json({ error: 'ระบบทำงานขัดข้อง' });
    }
});

// 2. Submit a new ticket
app.post('/api/tickets', async (req, res) => {
    const { title, reporter, department, equipment, details, urgency, image } = req.body;

    if (!title || !reporter || !department || !details || !urgency) {
        return res.status(400).json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' });
    }

    try {
        let nextId = 1;
        if (supabase) {
            // Find max id using select
            const { data, error } = await supabase.from('tickets').select('id');
            if (error) {
                console.error("Supabase select ID error:", error);
                return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการรันรหัสตั๋ว' });
            }
            const ids = (data || []).map(t => {
                const parts = t.id.split("-");
                return parts.length > 1 ? parseInt(parts[1], 10) : 0;
            });
            const maxId = ids.length > 0 ? Math.max(...ids) : 0;
            nextId = maxId + 1;
        } else {
            const tickets = readDatabaseLocal();
            const ids = tickets.map(t => {
                const parts = t.id.split("-");
                return parts.length > 1 ? parseInt(parts[1], 10) : 0;
            });
            const maxId = ids.length > 0 ? Math.max(...ids) : 0;
            nextId = maxId + 1;
        }

        const newId = `IT-${String(nextId).padStart(3, "0")}`;

        const newTicket = {
            id: newId,
            title,
            reporter,
            department,
            equipment: equipment || "",
            details,
            urgency,
            status: "รอดำเนินการ",
            createdAt: new Date().toISOString(),
            image: image || "",
            resolution: "",
            resolvedAt: null,
            logs: [
                {
                    time: new Date().toISOString(),
                    text: "แจ้งปัญหาและเปิดคำขอแจ้งซ่อมสำเร็จ",
                    user: reporter,
                    status: "รอดำเนินการ"
                }
            ]
        };

        if (supabase) {
            const { error } = await supabase.from('tickets').insert([newTicket]);
            if (error) {
                console.error("Supabase insert ticket error:", error);
                return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกตั๋วซ่อม' });
            }
            res.status(201).json(newTicket);
        } else {
            const tickets = readDatabaseLocal();
            tickets.push(newTicket);
            writeDatabaseLocal(tickets);
            res.status(201).json(newTicket);
        }
    } catch (err) {
        console.error("Post ticket catch error:", err);
        res.status(500).json({ error: 'ระบบทำงานขัดข้อง' });
    }
});

// 3. Update status & resolution of a ticket
app.put('/api/tickets/:id', async (req, res) => {
    // Protect endpoint - check if user is IT staff
    const roleHeader = req.headers['x-session-role'];
    if (roleHeader !== 'staff') {
        return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง: เฉพาะเจ้าหน้าที่ IT เท่านั้น' });
    }

    const ticketId = req.params.id;
    const { status, resolution, staffName } = req.body;

    if (status === "แก้ไขแล้ว" && !resolution) {
        return res.status(400).json({ error: 'กรุณากรอกบันทึกวิธีแก้ไขปัญหาก่อนตั้งเป็น แก้ไขแล้ว' });
    }

    try {
        let ticketToUpdate = null;
        let ticketsLocal = [];
        let ticketIndexLocal = -1;

        if (supabase) {
            const { data, error } = await supabase
                .from('tickets')
                .select('*')
                .eq('id', ticketId)
                .maybeSingle();

            if (error || !data) {
                console.error("Supabase find ticket error:", error);
                return res.status(404).json({ error: 'ไม่พบรายการ Ticket ที่ต้องการอัปเดต' });
            }
            ticketToUpdate = data;
        } else {
            ticketsLocal = readDatabaseLocal();
            ticketIndexLocal = ticketsLocal.findIndex(t => t.id === ticketId);
            if (ticketIndexLocal === -1) {
                return res.status(404).json({ error: 'ไม่พบรายการ Ticket ที่ต้องการอัปเดต' });
            }
            ticketToUpdate = ticketsLocal[ticketIndexLocal];
        }

        // Apply changes
        ticketToUpdate.status = status;
        ticketToUpdate.resolution = resolution || "";
        ticketToUpdate.resolvedAt = (status === "แก้ไขแล้ว") ? new Date().toISOString() : null;

        // Ensure logs array exists
        if (!ticketToUpdate.logs) {
            ticketToUpdate.logs = [];
        }

        // Append log
        ticketToUpdate.logs.push({
            time: new Date().toISOString(),
            text: `เปลี่ยนสถานะเป็น '${status}' ${resolution ? `พร้อมลงบันทึก: ${resolution}` : ''}`,
            user: staffName || "IT Staff",
            status: status
        });

        if (supabase) {
            const { error } = await supabase
                .from('tickets')
                .update({
                    status: ticketToUpdate.status,
                    resolution: ticketToUpdate.resolution,
                    resolvedAt: ticketToUpdate.resolvedAt,
                    logs: ticketToUpdate.logs
                })
                .eq('id', ticketId);

            if (error) {
                console.error("Supabase update ticket error:", error);
                return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตฐานข้อมูล' });
            }
            res.json(ticketToUpdate);
        } else {
            ticketsLocal[ticketIndexLocal] = ticketToUpdate;
            writeDatabaseLocal(ticketsLocal);
            res.json(ticketToUpdate);
        }
    } catch (err) {
        console.error("Put ticket catch error:", err);
        res.status(500).json({ error: 'ระบบทำงานขัดข้อง' });
    }
});

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
