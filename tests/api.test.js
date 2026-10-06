const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
test('helpdesk authentication and role workflows', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'helpdesk-test-'));
    process.env.DATA_DIR = root;
    process.env.USE_SUPABASE = 'false';
    const { hashPassword } = require('../backend/helpers/security');
    const users = [];
    for (const [username, role] of [['admin', 'admin'], ['staff', 'staff'], ['alice', 'user'], ['bob', 'user']]) users.push({ username, role, name: username, active: true, password: await hashPassword('test-password-123') });
    fs.writeFileSync(path.join(root, 'users.json'), JSON.stringify(users));
    fs.writeFileSync(path.join(root, 'tickets.json'), '[]');
    const server = require('../backend/server').listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); });
    const base = `http://127.0.0.1:${server.address().port}`;
    async function request(url, { cookie, method = 'GET', body, headers = {} } = {}) {
        const response = await fetch(base + url, { method, headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
        return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], rawCookie: response.headers.get('set-cookie') };
    }
    let alice, bob, staff, admin, ticket;
    await t.test('anonymous and forged role are rejected', async () => {
        assert.equal((await request('/api/tickets')).status, 401);
        assert.equal((await request('/api/tickets/IT-001', { method: 'PUT', headers: { 'X-Session-Role': 'staff' }, body: {} })).status, 401);
        assert.equal((await request('/api/auth/login', { method: 'POST', body: { username: 'alice', password: 'wrong' } })).status, 401);
    });
    await t.test('real login sets private session cookie and exposes no credentials', async () => {
        for (const username of ['alice', 'bob', 'staff', 'admin']) {
            const result = await request('/api/auth/login', { method: 'POST', body: { username, password: 'test-password-123' } });
            assert.equal(result.status, 200); assert.match(result.rawCookie, /HttpOnly/); assert.match(result.rawCookie, /SameSite=Strict/);
            assert.equal(result.data.password, undefined); assert.equal(result.data.token, undefined);
            if (username === 'alice') alice = result.cookie; if (username === 'bob') bob = result.cookie;
            if (username === 'staff') staff = result.cookie; if (username === 'admin') admin = result.cookie;
        }
        assert.equal((await request('/api/auth/me', { cookie: alice })).data.username, 'alice');
        const sessions = JSON.parse(fs.readFileSync(path.join(root, 'sessions.json')));
        assert.ok(!JSON.stringify(sessions).includes(alice.split('=')[1]));
    });
    await t.test('server binds reporter and isolates ticket ownership', async () => {
        const result = await request('/api/tickets', { method: 'POST', cookie: alice, body: { title: 'Network down', department: 'Finance', details: 'Cannot connect', urgency: 'สูง', reporter: 'bob', reporterUsername: 'bob' } });
        assert.equal(result.status, 201); ticket = result.data;
        assert.equal(ticket.reporterUsername, 'alice'); assert.equal(ticket.reporter, 'alice');
        assert.equal((await request('/api/tickets', { cookie: alice })).data.length, 1);
        assert.equal((await request('/api/tickets', { cookie: bob })).data.length, 0);
        assert.equal((await request('/api/tickets', { cookie: staff })).data.length, 1);
    });
    await t.test('user cannot update or manage accounts even with spoofed role', async () => {
        assert.equal((await request(`/api/tickets/${ticket.id}`, { method: 'PUT', cookie: alice, headers: { 'X-Session-Role': 'admin' }, body: { status: 'แก้ไขแล้ว', resolution: 'fake' } })).status, 403);
        assert.equal((await request('/api/users', { cookie: alice })).status, 403);
        assert.equal((await request('/api/users', { cookie: staff })).status, 403);
    });
    await t.test('ticket validates status and resolution, trusts staff identity', async () => {
        assert.equal((await request(`/api/tickets/${ticket.id}`, { method: 'PUT', cookie: staff, body: { status: 'invalid', resolution: '' } })).status, 400);
        assert.equal((await request(`/api/tickets/${ticket.id}`, { method: 'PUT', cookie: staff, body: { status: 'แก้ไขแล้ว', resolution: ' ' } })).status, 400);
        const result = await request(`/api/tickets/${ticket.id}`, { method: 'PUT', cookie: staff, body: { status: 'แก้ไขแล้ว', resolution: 'Replaced cable', staffName: 'fake' } });
        assert.equal(result.status, 200); assert.equal(result.data.logs.at(-1).user, 'staff'); assert.ok(result.data.resolvedAt);
        const reopened = await request(`/api/tickets/${ticket.id}`, { method: 'PUT', cookie: staff, body: { status: 'กำลังแก้ไข', resolution: 'Investigating again' } });
        assert.equal(reopened.data.resolvedAt, null);
    });
    await t.test('admin creates hashed account and rejects duplicate/self disable', async () => {
        const body = { username: 'newuser', name: 'New User', role: 'user', password: 'new-password-123' };
        assert.equal((await request('/api/users', { method: 'POST', cookie: admin, body })).status, 201);
        assert.equal((await request('/api/users', { method: 'POST', cookie: admin, body })).status, 409);
        assert.equal((await request('/api/users/admin', { method: 'PUT', cookie: admin, body: { role: 'user', active: false } })).status, 400);
        const accounts = (await request('/api/users', { cookie: admin })).data;
        assert.ok(accounts.every(user => !user.password));
        assert.match(JSON.parse(fs.readFileSync(path.join(root, 'users.json'))).find(user => user.username === 'newuser').password, /^scrypt\$/);
    });
    await t.test('disable and role changes revoke existing sessions', async () => {
        assert.equal((await request('/api/users/bob', { method: 'PUT', cookie: admin, body: { role: 'user', active: false } })).status, 200);
        assert.equal((await request('/api/auth/me', { cookie: bob })).status, 401);
        assert.equal((await request('/api/auth/login', { method: 'POST', body: { username: 'bob', password: 'test-password-123' } })).status, 401);
    });
    await t.test('change password revokes sessions and updates login', async () => {
        assert.equal((await request('/api/auth/password', { method: 'POST', cookie: alice, body: { currentPassword: 'wrong', newPassword: 'new-password-123' } })).status, 400);
        assert.equal((await request('/api/auth/password', { method: 'POST', cookie: alice, body: { currentPassword: 'test-password-123', newPassword: 'new-password-123' } })).status, 200);
        assert.equal((await request('/api/auth/me', { cookie: alice })).status, 401);
        assert.equal((await request('/api/auth/login', { method: 'POST', body: { username: 'alice', password: 'test-password-123' } })).status, 401);
        alice = (await request('/api/auth/login', { method: 'POST', body: { username: 'alice', password: 'new-password-123' } })).cookie;
    });
    await t.test('malformed payloads, image and foreign origin rejected', async () => {
        assert.equal((await request('/api/tickets', { method: 'POST', cookie: alice, body: { title: [], department: 'IT', details: 'x', urgency: 'สูง' } })).status, 400);
        assert.equal((await request('/api/tickets', { method: 'POST', cookie: alice, body: { title: 'x', department: 'IT', details: 'x', urgency: 'สูง', image: 'data:image/svg+xml;base64,abcd' } })).status, 400);
        assert.equal((await request('/api/auth/logout', { method: 'POST', cookie: alice, headers: { Origin: 'https://attacker.invalid' } })).status, 403);
    });
    await t.test('configured public origin can log in behind HTTPS proxy', async () => {
        const previous = process.env.APP_ORIGIN;
        const origins = ['https://it-helpdesk-pondz2.vercel.app', 'https://it-helpdesk-beige-five.vercel.app'];
        process.env.APP_ORIGIN = origins.join(', ');
        try {
            for (const origin of origins) {
                const result = await request('/api/auth/login', { method: 'POST', headers: { Origin: origin }, body: { username: 'staff', password: 'test-password-123' } });
                assert.equal(result.status, 200);
                assert.equal(result.data.role, 'staff');
                assert.equal((await request('/api/auth/logout', { method: 'POST', cookie: result.cookie, headers: { Origin: origin } })).status, 200);
            }
            for (const origin of ['https://attacker.invalid', 'https://it-helpdesk-beige-five.vercel.app.attacker.invalid']) {
                assert.equal((await request('/api/auth/login', { method: 'POST', headers: { Origin: origin }, body: { username: 'staff', password: 'test-password-123' } })).status, 403);
            }
        } finally {
            if (previous === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = previous;
        }
    });
    await t.test('self registration and single-use recovery preserve role and revoke sessions', async () => {
        const body = { username: 'selfuser', name: 'Self User', password: 'self-password-123', role: 'admin', active: false };
        assert.equal((await request('/api/auth/register', { method: 'POST', body: { ...body, password: 'short' } })).status, 400);
        const registered = await request('/api/auth/register', { method: 'POST', body });
        assert.equal(registered.status, 201);
        assert.equal(registered.data.user.role, 'user'); assert.equal(registered.data.user.active, true);
        assert.equal(registered.data.user.recoveryHash, undefined);
        assert.match(registered.data.recoveryCode, /^[A-F0-9]{8}(-[A-F0-9]{8}){7}$/);
        assert.equal((await request('/api/auth/register', { method: 'POST', body })).status, 409);
        assert.ok(!fs.readFileSync(path.join(root, 'users.json'), 'utf8').includes(registered.data.recoveryCode));
        const logged = await request('/api/auth/login', { method: 'POST', body: { username: body.username, password: body.password } });
        assert.equal(logged.status, 200);
        assert.equal((await request('/api/auth/recovery-code', { method: 'POST', cookie: logged.cookie, body: { currentPassword: 'wrong' } })).status, 400);
        const issued = await request('/api/auth/recovery-code', { method: 'POST', cookie: logged.cookie, body: { currentPassword: body.password } });
        assert.equal(issued.status, 200);
        assert.equal((await request('/api/auth/reset-password', { method: 'POST', body: { username: body.username, recoveryCode: registered.data.recoveryCode, newPassword: 'reset-password-123' } })).status, 400);
        const resets = await Promise.all([1, 2].map(() => request('/api/auth/reset-password', { method: 'POST', body: { username: body.username, recoveryCode: issued.data.recoveryCode.toLowerCase(), newPassword: 'reset-password-123' } })));
        assert.deepEqual(resets.map(r => r.status).sort(), [200, 400]);
        assert.equal((await request('/api/auth/me', { cookie: logged.cookie })).status, 401);
        assert.equal((await request('/api/auth/login', { method: 'POST', body: { username: body.username, password: body.password } })).status, 401);
        assert.equal((await request('/api/auth/login', { method: 'POST', body: { username: body.username, password: 'reset-password-123' } })).status, 200);
        await require('../backend/helpers/store').update('users', 'username', body.username, { active: false });
        assert.equal((await request('/api/auth/reset-password', { method: 'POST', body: { username: body.username, recoveryCode: resets.find(r => r.status === 200).data.recoveryCode, newPassword: 'another-password-123' } })).status, 400);
    });
    await t.test('logout and expiry invalidate cookies', async () => {
        assert.equal((await request('/api/auth/logout', { method: 'POST', cookie: alice })).status, 200);
        assert.equal((await request('/api/auth/me', { cookie: alice })).status, 401);
        const sessionsFile = path.join(root, 'sessions.json');
        const sessions = JSON.parse(fs.readFileSync(sessionsFile));
        sessions.forEach(session => { session.expiresAt = '2000-01-01T00:00:00.000Z'; });
        fs.writeFileSync(sessionsFile, JSON.stringify(sessions));
        assert.equal((await request('/api/auth/me', { cookie: admin })).status, 401);
    });
    await t.test('demo list checks accounts and requires explicit opt-in in production', async () => {
        const store = require('../backend/helpers/store');
        await store.insert('users', { username: 'user1', name: 'Demo User', role: 'user', active: true, password: await hashPassword('userpassword') });
        await store.insert('users', { username: 'it_staff', name: 'Demo Staff', role: 'staff', active: true, password: await hashPassword('itpassword') });
        const result = await request('/api/auth/demo-accounts');
        assert.equal(result.status, 200);
        assert.deepEqual(result.data.map(user => user.username), ['user1', 'it_staff']);
        await store.update('users', 'username', 'user1', { password: await hashPassword('different-password') });
        assert.deepEqual((await request('/api/auth/demo-accounts')).data.map(user => user.username), ['it_staff']);
        const previous = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const previousDemo = process.env.ENABLE_DEMO_ACCOUNTS;
        const previousRoles = process.env.DEMO_ACCOUNT_ROLES;
        try {
            delete process.env.ENABLE_DEMO_ACCOUNTS;
            assert.deepEqual((await request('/api/auth/demo-accounts')).data, []);
            process.env.ENABLE_DEMO_ACCOUNTS = 'true';
            assert.deepEqual((await request('/api/auth/demo-accounts')).data.map(user => user.username), ['it_staff']);
            process.env.DEMO_ACCOUNT_ROLES = 'user';
            assert.deepEqual((await request('/api/auth/demo-accounts')).data, []);
            process.env.ENABLE_DEMO_ACCOUNTS = 'false';
            assert.deepEqual((await request('/api/auth/demo-accounts')).data, []);
        } finally {
            if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
            if (previousDemo === undefined) delete process.env.ENABLE_DEMO_ACCOUNTS; else process.env.ENABLE_DEMO_ACCOUNTS = previousDemo;
            if (previousRoles === undefined) delete process.env.DEMO_ACCOUNT_ROLES; else process.env.DEMO_ACCOUNT_ROLES = previousRoles;
        }
    });
});
