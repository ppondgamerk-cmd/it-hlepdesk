const crypto = require('node:crypto');
const store = require('../helpers/store');
const { hashPassword, verifyPassword, digest, publicUser } = require('../helpers/security');
const { tokenFrom, setCookie } = require('../middleware/auth');
exports.login = async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || password.length > 256) return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ถูกต้อง' });
    let [user] = await store.list('users', { username: username.trim() });
    if (!user || user.active === false || !['user', 'staff', 'admin'].includes(user.role) || !await verifyPassword(password, user.password)) return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกปิดใช้งาน' });
    if (!user.password.startsWith('scrypt$')) {
        const hashed = await hashPassword(password);
        await store.update('users', 'username', user.username, { password: hashed });
        user = { ...user, password: hashed };
    }
    const token = crypto.randomBytes(32).toString('hex');
    await store.insert('sessions', { tokenHash: digest(token), username: user.username, credentialHash: digest(user.password), expiresAt: new Date(Date.now() + 8 * 3600000).toISOString() });
    setCookie(res, token);
    res.json(publicUser(user));
};
exports.me = (req, res) => res.json(publicUser(req.user));
exports.logout = async (req, res) => {
    const token = tokenFrom(req);
    if (token) await store.remove('sessions', 'tokenHash', digest(token));
    setCookie(res, '', 0);
    res.json({ success: true });
};
exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 10 || newPassword.length > 128) return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีความยาว 10–128 ตัวอักษร' });
    if (!await verifyPassword(currentPassword, req.user.password)) return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    await store.update('users', 'username', req.user.username, { password: await hashPassword(newPassword) });
    setCookie(res, '', 0);
    res.json({ success: true });
};
