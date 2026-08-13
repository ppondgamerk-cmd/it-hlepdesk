const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const DB_PATH = path.join(__dirname, '../../data', 'tickets.json');
const USERS_PATH = path.join(__dirname, '../../data', 'users.json');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey && process.env.USE_SUPABASE !== 'false') {
    try {
        supabase = createClient(supabaseUrl, supabaseKey);
        console.log("=================================================");
        console.log(" Successfully connected to Supabase Cloud Database!");
        console.log("=================================================");
    } catch (err) {
        console.error("Failed to initialize Supabase client:", err);
    }
} else {
    console.log("=================================================");
    console.log(" SUPABASE_URL & SUPABASE_KEY/SUPABASE_SECRET_KEY missing in Env.");
    console.log(" Running in Local JSON Database Fallback mode!");
    console.log("=================================================");
}

module.exports = {
    supabase,
    DB_PATH,
    USERS_PATH
};
