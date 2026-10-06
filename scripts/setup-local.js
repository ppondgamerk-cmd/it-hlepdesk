const fs = require('node:fs');
const path = require('node:path');
const { hashPassword } = require('../backend/helpers/security');
async function setup() {
    const root = process.env.DATA_DIR || path.join(__dirname, '../data');
    const usersFile = path.join(root, 'users.json');
    const ticketsFile = path.join(root, 'tickets.json');
    fs.mkdirSync(root, { recursive: true });
    if (!fs.existsSync(usersFile)) fs.copyFileSync(path.join(__dirname, '../data/users.example.json'), usersFile);
    if (!fs.existsSync(ticketsFile)) fs.writeFileSync(ticketsFile, '[]');
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    if (!users.some(user => user.username === 'admin') && process.env.INITIAL_ADMIN_PASSWORD) {
        if (process.env.INITIAL_ADMIN_PASSWORD.length < 10) throw new Error('INITIAL_ADMIN_PASSWORD must contain at least 10 characters.');
        users.push({ username: 'admin', name: 'admin', role: 'admin', active: true, password: await hashPassword(process.env.INITIAL_ADMIN_PASSWORD) });
    }
    for (const user of users) {
        if (!user.password.startsWith('scrypt$')) user.password = await hashPassword(user.password);
        if (user.username === 'admin' && user.role === 'staff') user.role = 'admin';
        if (user.active === undefined) user.active = true;
    }
    const tickets = JSON.parse(fs.readFileSync(ticketsFile, 'utf8'));
    for (const ticket of tickets) {
        if (ticket.reporterUsername) continue;
        const owners = users.filter(user => user.name === ticket.reporter);
        if (owners.length === 1) ticket.reporterUsername = owners[0].username;
    }
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    fs.writeFileSync(ticketsFile, JSON.stringify(tickets, null, 2));
    console.log('Local setup complete: hashed passwords, admin role and ticket ownership.');
}
setup().catch(error => { console.error(error.message); process.exitCode = 1; });
