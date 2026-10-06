const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const store = require('../helpers/store');
const { verifyPassword } = require('../helpers/security');

router.get('/demo-accounts', async (req, res) => {
    const demoSetting = process.env.ENABLE_DEMO_ACCOUNTS;
    if (demoSetting === 'false' || ((process.env.NODE_ENV === 'production' || process.env.VERCEL) && demoSetting !== 'true')) return res.json([]);
    const examples = [
        { username: 'user1', password: 'userpassword', role: 'user', label: 'ผู้แจ้งซ่อม', description: 'แจ้งปัญหาและติดตามงานของตัวเอง' },
        { username: 'it_staff', password: 'itpassword', role: 'staff', label: 'เจ้าหน้าที่ IT', description: 'ดูแลรายการซ่อมและบันทึกวิธีแก้ไข' }
    ];
    const available = [];
    const visibleRoles = (process.env.DEMO_ACCOUNT_ROLES || 'user,staff').split(',').map(role => role.trim());
    for (const example of examples) {
        if (!visibleRoles.includes(example.role)) continue;
        const [user] = await store.list('users', { username: example.username });
        if (user && user.active !== false && user.role === example.role && await verifyPassword(example.password, user.password)) available.push(example);
    }
    res.json(available);
});

router.post('/login', require('../middleware/loginLimit'), authController.login);
router.get('/me', authenticate, authController.me);
router.post('/logout', authController.logout);
router.post('/password', authenticate, authController.changePassword);

module.exports = router;
