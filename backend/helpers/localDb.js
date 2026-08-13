const fs = require('fs');
const path = require('path');
const { DB_PATH, USERS_PATH } = require('../config/db');

function readUsersLocal() {
    try {
        if (!fs.existsSync(USERS_PATH)) return [];
        const data = fs.readFileSync(USERS_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading users database:', err);
        return [];
    }
}

function readDatabaseLocal() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
            fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
            return [];
        }
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading database:', err);
        return [];
    }
}

function writeDatabaseLocal(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('Error writing database:', err);
    }
}

module.exports = {
    readUsersLocal,
    readDatabaseLocal,
    writeDatabaseLocal
};
