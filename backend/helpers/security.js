const crypto = require('node:crypto');
const scrypt = require('node:util').promisify(crypto.scrypt);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    return `scrypt$${salt}$${(await scrypt(password, salt, 64)).toString('hex')}`;
}
async function verifyPassword(password, stored) {
    if (typeof stored !== 'string') return false;
    if (!stored.startsWith('scrypt$')) return crypto.timingSafeEqual(Buffer.from(digest(password)), Buffer.from(digest(stored)));
    const [, salt, hash] = stored.split('$');
    if (!salt || !/^[a-f0-9]{128}$/.test(hash || '')) return false;
    return crypto.timingSafeEqual(await scrypt(password, salt, 64), Buffer.from(hash, 'hex'));
}
const publicUser = ({ username, name, role, active }) => ({ username, name, role, active: active !== false });
module.exports = { hashPassword, verifyPassword, digest, publicUser };
