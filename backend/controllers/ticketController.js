const crypto = require('node:crypto');
const store = require('../helpers/store');
const statuses = ['รอดำเนินการ', 'กำลังแก้ไข', 'แก้ไขแล้ว'];
exports.getAllTickets = async (req, res) => {
    const tickets = await store.list('tickets', req.user.role === 'user' ? { reporterUsername: req.user.username } : {});
    res.json(tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
};
exports.createTicket = async (req, res) => {
    const body = req.body || {};
    for (const [key, max, required] of [['title', 180, true], ['department', 100, true], ['details', 5000, true], ['equipment', 100, false]]) {
        if ((required && (typeof body[key] !== 'string' || !body[key].trim())) || (body[key] !== undefined && (typeof body[key] !== 'string' || body[key].length > max))) return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบและไม่เกินความยาวที่กำหนด' });
    }
    if (!['ต่ำ', 'กลาง', 'สูง'].includes(body.urgency)) return res.status(400).json({ error: 'ระดับความเร่งด่วนไม่ถูกต้อง' });
    const image = body.image || '';
    if (typeof image !== 'string' || (image && !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) || Buffer.byteLength(image.split(',')[1] || '', 'base64') > 2 * 1024 * 1024) return res.status(400).json({ error: 'รองรับภาพ PNG, JPEG, WebP หรือ GIF ขนาดไม่เกิน 2MB' });
    const time = new Date().toISOString();
    const ticket = { id: `IT-${crypto.randomUUID().toUpperCase()}`, title: body.title.trim(), department: body.department.trim(), details: body.details.trim(), equipment: (body.equipment || '').trim(), urgency: body.urgency, reporter: req.user.name, reporterUsername: req.user.username, status: statuses[0], createdAt: time, image, resolution: '', resolvedAt: null, logs: [{ time, text: 'เปิดคำขอแจ้งซ่อมสำเร็จ', user: req.user.name, status: statuses[0] }] };
    await store.insert('tickets', ticket);
    res.status(201).json(ticket);
};
exports.updateTicket = async (req, res) => store.locked(async () => {
    const { status, resolution } = req.body || {};
    if (!statuses.includes(status) || typeof resolution !== 'string' || resolution.length > 5000 || (status === statuses[2] && !resolution.trim())) return res.status(400).json({ error: 'ตรวจสอบสถานะ และกรอกวิธีแก้ไขก่อนปิดงาน (ไม่เกิน 5,000 ตัวอักษร)' });
    const [ticket] = await store.list('tickets', { id: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'ไม่พบรายการแจ้งซ่อม' });
    const time = new Date().toISOString();
    const changes = { status, resolution: resolution.trim(), resolvedAt: status === statuses[2] ? (ticket.status === statuses[2] ? ticket.resolvedAt : time) : null, logs: [...(ticket.logs || []), { time, text: `เปลี่ยนสถานะเป็น ${status}${resolution.trim() ? ` — ${resolution.trim()}` : ''}`, user: req.user.name, status }] };
    await store.update('tickets', 'id', ticket.id, changes);
    res.json({ ...ticket, ...changes });
});
