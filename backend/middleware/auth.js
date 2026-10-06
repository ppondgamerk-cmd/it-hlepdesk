const store = require('../helpers/store');
const { digest } = require('../helpers/security');
const COOKIE = 'helpdesk_session';
function tokenFrom(req) {
    const match = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`));
    return match ? match.slice(COOKIE.length + 1) : '';
}
function setCookie(res, token, maxAge = 28800) {
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' || !!process.env.VERCEL, path: '/', maxAge: maxAge * 1000 });
}
async function authenticate(req, res, next) {
    try {
        const token = tokenFrom(req);
        if (!/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
        const [session] = await store.list('sessions', { tokenHash: digest(token) });
        if (!session || new Date(session.expiresAt) <= new Date()) return res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง' });
        const [user] = await store.list('users', { username: session.username });
        if (!user || user.active === false || digest(user.password) !== session.credentialHash || !['user', 'staff', 'admin'].includes(user.role)) return res.status(401).json({ error: 'บัญชีหรือเซสชันไม่สามารถใช้งานได้ กรุณาเข้าสู่ระบบใหม่' });
        req.user = user;
        next();
    } catch (error) { next(error); }
}
const allow = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'คุณไม่มีสิทธิ์ดำเนินการนี้' });
module.exports = { authenticate, allow, tokenFrom, setCookie };
