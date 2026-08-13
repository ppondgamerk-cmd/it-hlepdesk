const { supabase } = require('../config/db');
const { readUsersLocal } = require('../helpers/localDb');

exports.login = async (req, res) => {
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
};
