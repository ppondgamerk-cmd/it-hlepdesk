const crypto = require('node:crypto');
const store = require('../helpers/store');
const { hashPassword, verifyPassword, digest, publicUser } = require('../helpers/security');
const { tokenFrom, setCookie } = require('../middleware/auth');
const validPassword = password => typeof password === 'string' && password.length >= 10 && password.length <= 128;
const newRecoveryCode = () => crypto.randomBytes(32).toString('hex').toUpperCase().match(/.{8}/g).join('-');
const recoveryDigest = code => digest(code.replace(/[-\s]/g, '').toUpperCase());
exports.register = async (req, res) => {
    const { username, name, password } = req.body || {};
    if (typeof username !== 'string' || !/^[a-zA-Z0-9_.-]{3,40}$/.test(username) || typeof name !== 'string' || !name.trim() || name.length > 100 || !validPassword(password)) return res.status(400).json({ error: 'ตรวจสอบชื่อผู้ใช้ (3–40 ตัวอักษร), ชื่อ และรหัสผ่าน (10–128 ตัวอักษร)' });
    const recoveryCode = newRecoveryCode();
    try {
        const user = await store.insert('users', { username, name: name.trim(), password: await hashPassword(password), role: 'user', active: true, recoveryHash: recoveryDigest(recoveryCode) });
        res.status(201).json({ user: publicUser(user), recoveryCode });
    } catch (error) { if (error.code === '23505') return res.status(409).json({ error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' }); throw error; }
};
exports.resetPassword = async (req, res) => {
    const { username, recoveryCode, newPassword } = req.body || {};
    if (typeof username !== 'string' || !/^[a-zA-Z0-9_.-]{3,40}$/.test(username) || typeof recoveryCode !== 'string' || recoveryCode.length > 150 || !/^[a-f0-9]{64}$/i.test(recoveryCode.replace(/[-\s]/g, '')) || !validPassword(newPassword)) return res.status(400).json({ error: 'ตรวจสอบชื่อผู้ใช้ รหัสกู้คืน และรหัสผ่านใหม่ (10–128 ตัวอักษร)' });
    const nextCode = newRecoveryCode();
    const changed = await store.updateWhere('users', { username, active: true, recoveryHash: recoveryDigest(recoveryCode) }, { password: await hashPassword(newPassword), recoveryHash: recoveryDigest(nextCode) });
    if (!changed) return res.status(400).json({ error: 'ชื่อผู้ใช้หรือรหัสกู้คืนไม่ถูกต้อง หรือรหัสนี้ถูกใช้แล้ว' });
    setCookie(res, '', 0);
    res.json({ success: true, recoveryCode: nextCode });
};
exports.issueRecoveryCode = async (req, res) => {
    const { currentPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || currentPassword.length > 256 || !await verifyPassword(currentPassword, req.user.password)) return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    const recoveryCode = newRecoveryCode();
    const changed = await store.updateWhere('users', { username: req.user.username, password: req.user.password, active: true }, { recoveryHash: recoveryDigest(recoveryCode) });
    if (!changed) return res.status(409).json({ error: 'บัญชีมีการเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่' });
    res.json({ recoveryCode });
};
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
