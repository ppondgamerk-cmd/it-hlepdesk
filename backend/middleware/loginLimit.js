const attempts = new Map();
module.exports = (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const username = typeof req.body?.username === 'string' ? req.body.username.trim().slice(0, 40) : '';
    const key = `${req.ip}:${username}`;
    const entry = attempts.get(key) || { count: 0, until: now + 15 * 60000 };
    if (entry.count >= 15) {
        res.setHeader('Retry-After', Math.ceil((entry.until - now) / 1000));
        return res.status(429).json({ error: 'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาที' });
    }
    entry.count++;
    attempts.set(key, entry);
    res.on('finish', () => { if (res.statusCode === 200) attempts.delete(key); });
    next();
};
