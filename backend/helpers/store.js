const fs = require('node:fs');
const path = require('node:path');
const { supabase } = require('../config/db');
const root = process.env.DATA_DIR || path.join(__dirname, '../../data');
function read(table) {
    const file = path.join(root, `${table}.json`);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}
function write(table, rows) {
    fs.mkdirSync(root, { recursive: true });
    const file = path.join(root, `${table}.json`);
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(rows, null, 2), { mode: 0o600 });
    fs.renameSync(`${file}.tmp`, file);
}
async function list(table, filters = {}) {
    if (!supabase) return read(table).filter(row => Object.entries(filters).every(([key, value]) => row[key] === value));
    let query = supabase.from(table).select('*');
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}
async function insert(table, row) {
    if (!supabase) {
        const rows = read(table);
        const key = table === 'users' ? 'username' : table === 'sessions' ? 'tokenHash' : 'id';
        if (rows.some(item => item[key] === row[key])) { const error = new Error('Duplicate record'); error.code = '23505'; throw error; }
        write(table, [...(table === 'sessions' ? rows.filter(item => new Date(item.expiresAt) > new Date()) : rows), row]);
    } else {
        const { error } = await supabase.from(table).insert(row);
        if (error) throw error;
    }
    return row;
}
async function update(table, key, value, changes) {
    if (!supabase) write(table, read(table).map(row => row[key] === value ? { ...row, ...changes } : row));
    else { const { error } = await supabase.from(table).update(changes).eq(key, value); if (error) throw error; }
}
async function remove(table, key, value) {
    if (!supabase) write(table, read(table).filter(row => row[key] !== value));
    else { const { error } = await supabase.from(table).delete().eq(key, value); if (error) throw error; }
}
let queue = Promise.resolve();
function locked(task) { const result = queue.then(task); queue = result.catch(() => {}); return result; }
module.exports = { list, insert, update, remove, locked };
