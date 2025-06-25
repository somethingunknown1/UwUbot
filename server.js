require('dotenv').config(); // Load environment variables

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
const axios = require('axios');
const app = express();
const PORT = 3000;
const DATA_FILE = './users.json';
const ADMIN_LOG_FILE = './admin-logs.json';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));
app.use(session({
    secret: 'your-very-secret-key', // change this to something secure
    resave: false,
    saveUninitialized: false
}));

// Helper to read/write data
function readData() {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE));
}
function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function readAdminLogs() {
    if (!fs.existsSync(ADMIN_LOG_FILE)) return [];
    return JSON.parse(fs.readFileSync(ADMIN_LOG_FILE));
}
function writeAdminLogs(logs) {
    fs.writeFileSync(ADMIN_LOG_FILE, JSON.stringify(logs, null, 2));
}

// Admin: Add or update user (append application results and merge notes)
app.post('/api/users', (req, res) => {
    const { username, userId, notes, appStatus, appReason } = req.body;
    if (!username || !userId) return res.status(400).json({ error: 'Missing username or userId' });

    const data = readData();
    let user = data.find(u => u.userId === userId);

    if (user) {
        // Merge notes (combine old and new, remove duplicates)
        let newNotes = Array.isArray(notes) ? notes : (notes ? [notes] : []);
        let existingNotes = Array.isArray(user.notes) ? user.notes : (user.notes ? [user.notes] : []);
        user.notes = Array.from(new Set([...existingNotes, ...newNotes])).filter(n => n);

        // Append new application result
        if (!user.applications) user.applications = [];
        if (appStatus || appReason) {
            user.applications.push({
                status: appStatus,
                reason: appReason,
                date: new Date().toISOString()
            });
        }
    } else {
        // Create new user
        user = {
            username,
            userId,
            notes: Array.isArray(notes) ? notes : (notes ? [notes] : []),
            applications: (appStatus || appReason) ? [{
                status: appStatus,
                reason: appReason,
                date: new Date().toISOString()
            }] : []
        };
        data.push(user);
    }

    writeData(data);
    res.json({ success: true, user });
});

// Admin login endpoint
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.json({ success: false, error: 'Incorrect password' });
    }
});

// User search endpoint
app.get('/api/users/search', (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json([]);
    const data = readData();
    const results = data.filter(u => u.userId === q || (u.username && u.username.toLowerCase() === q.toLowerCase()));
    res.json(results);
});

// Admin: Get all users (for admin panel)
app.get('/api/users', (req, res) => {
    res.json(readData());
});

app.get('/api/auth/discord', (req, res) => {
    const params = new URLSearchParams({
        client_id: '1387208510156177458',
        redirect_uri: 'https://uwu23-production.up.railway.app/api/auth/discord/callback',
        response_type: 'code',
        scope: 'identify guilds.members.read'
    });
    res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

app.get('/api/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send('No code provided from Discord.');

    try {
        // Exchange code for token
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: '1387208510156177458',
            client_secret: 'Yx8sPXybWUp4GMfUCqLfUtB2F2Sc6QYa',
            grant_type: 'authorization_code',
            code,
            redirect_uri: 'https://uwu23-production.up.railway.app/api/auth/discord/callback',
            scope: 'identify guilds.members.read'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const { access_token, token_type } = tokenRes.data;

        // Get user info
        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `${token_type} ${access_token}` }
        });
        const user = userRes.data;

        // Get member info for your guild
        const guildMemberRes = await axios.get(
            `https://discord.com/api/users/@me/guilds/1383451713540980906/member`,
            { headers: { Authorization: `${token_type} ${access_token}` } }
        );
        const member = guildMemberRes.data;

        // Check for required role
        const hasAdminRole = member.roles.includes('1387209090631208972');

        // Save to session
        req.session.user = {
            username: user.username,
            userId: user.id,
            hasAdminRole
        };

        // Redirect to homepage (or search panel)
        res.redirect(`/index.html?userId=${user.id}`);
    } catch (err) {
        console.error('Discord OAuth2 error:', err.response ? err.response.data : err);
        res.status(500).send('Discord authentication failed.');
    }
});

app.get('/api/auth/me', (req, res) => {
    if (req.session && req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// New session endpoint
app.get('/api/auth/session', (req, res) => {
    // Example: req.session.user = { id, username, roles: [roleId1, roleId2], ... }
    // You must set this in your Discord OAuth callback!
    res.json({
        user: req.session.user || null,
        discordRoleId: process.env.DISCORD_ROLE_ID
    });
});

// Endpoint to get admin logs
app.get('/api/admin/logs', (req, res) => {
    res.json(readAdminLogs());
});

// Edit note
app.post('/api/users/edit-note', (req, res) => {
    const { userId, noteIndex, newNote } = req.body;
    const data = readData();
    const user = data.find(u => u.userId === userId);
    if (!user || !Array.isArray(user.notes) || !user.notes[noteIndex]) return res.status(404).json({ error: 'Note not found' });
    user.notes[noteIndex] = newNote;
    writeData(data);
    res.json({ success: true });
});

// Delete note
app.post('/api/users/delete-note', (req, res) => {
    const { userId, noteIndex } = req.body;
    const data = readData();
    const user = data.find(u => u.userId === userId);
    if (!user || !Array.isArray(user.notes) || !user.notes[noteIndex]) return res.status(404).json({ error: 'Note not found' });
    user.notes.splice(noteIndex, 1);
    writeData(data);
    res.json({ success: true });
});

// Edit application
app.post('/api/users/edit-app', (req, res) => {
    const { userId, appIndex, newStatus, newReason } = req.body;
    const data = readData();
    const user = data.find(u => u.userId === userId);
    if (!user || !Array.isArray(user.applications) || !user.applications[appIndex]) return res.status(404).json({ error: 'Application not found' });
    user.applications[appIndex].status = newStatus;
    user.applications[appIndex].reason = newReason;
    writeData(data);
    res.json({ success: true });
});

// Delete application
app.post('/api/users/delete-app', (req, res) => {
    const { userId, appIndex } = req.body;
    const data = readData();
    const user = data.find(u => u.userId === userId);
    if (!user || !Array.isArray(user.applications) || !user.applications[appIndex]) return res.status(404).json({ error: 'Application not found' });
    user.applications.splice(appIndex, 1);
    writeData(data);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
