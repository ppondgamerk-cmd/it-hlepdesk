const router = require('express').Router();
const store = require('../helpers/store');
const { hashPassword, publicUser } = require('../helpers/security');
const { authenticate, allow } = require('../middleware/auth');
router.use(authenticate, allow('admin'));
router.get('/', async (req, res) => res.json((await store.list('users')).map(publicUser)));
router.post('/', async (req, res) => {
    const { username, name, role, password } = req.body || {};
    if (typeof username !== 'string' || !/^[a-zA-Z0-9_.-]{3,40}$/.test(username) || typeof name !== 'string' || !name.trim() || name.length > 100 || !['user', 'staff', 'admin'].includes(role) || typeof password !== 'string' || password.length < 10 || password.length > 128) return res.status(400).json({ error: 'ตรวจสอบชื่อผู้ใช้ (3–40 ตัวอักษร), ชื่อ, บทบาท และรหัสผ่าน (10–128 ตัวอักษร)' });
    try {
        const user = await store.insert('users', { username, name: name.trim(), role, password: await hashPassword(password), active: true });
        res.status(201).json(publicUser(user));
    } catch (error) { if (error.code === '23505') return res.status(409).json({ error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' }); throw error; }
});
router.put('/:username', async (req, res) => store.locked(async () => {
    const { role, active, password } = req.body || {};
    if (!['user', 'staff', 'admin'].includes(role) || typeof active !== 'boolean' || (password !== undefined && (typeof password !== 'string' || password.length < 10 || password.length > 128))) return res.status(400).json({ error: 'บทบาท สถานะ หรือรหัสผ่านไม่ถูกต้อง' });
    const [user] = await store.list('users', { username: req.params.username });
    if (!user) return res.status(404).json({ error: 'ไม่พบบัญชีผู้ใช้' });
    if (user.username === req.user.username && (role !== 'admin' || !active)) return res.status(400).json({ error: 'ไม่สามารถลดสิทธิ์หรือปิดบัญชีผู้ดูแลที่กำลังใช้งานได้' });
    const changes = { role, active };
    if (password !== undefined) { changes.password = await hashPassword(password); changes.recoveryHash = null; }
    await store.update('users', 'username', user.username, changes);
    await store.remove('sessions', 'username', user.username);
    res.json(publicUser({ ...user, ...changes }));
}));
module.exports = router;
