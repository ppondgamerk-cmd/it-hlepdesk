const { supabase } = require('../config/db');
const { readDatabaseLocal, writeDatabaseLocal } = require('../helpers/localDb');

// 1. Get all tickets
exports.getAllTickets = async (req, res) => {
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
};

// 2. Submit a new ticket
exports.createTicket = async (req, res) => {
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
};

// 3. Update status & resolution of a ticket
exports.updateTicket = async (req, res) => {
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
};
