document.addEventListener('DOMContentLoaded', async function() {
    // Navigation
    function showPanel(panel) {
        ['main-content', 'search-panel', 'admin-signin-panel', 'admin-panel'].forEach(id => {
            document.getElementById(id).style.display = 'none';
        });
        if (panel) panel.style.display = '';
    }
    document.getElementById('home-link').onclick = e => { e.preventDefault(); showPanel(document.getElementById('main-content')); };
    document.getElementById('search-link').onclick = e => { e.preventDefault(); showPanel(document.getElementById('search-panel')); };
    document.getElementById('admin-link').onclick = e => { e.preventDefault(); showPanel(document.getElementById('admin-signin-panel')); };

    // Discord login
    document.getElementById('discord-login-btn-home').onclick = function() {
        window.location.href = '/api/auth/discord';
    };

    // Check Discord session for admin role
    let isDiscordAdmin = false;
    try {
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        if (session && session.user && session.user.roles && session.user.roles.includes(session.discordRoleId)) {
            isDiscordAdmin = true;
        }
    } catch {}

    // If Discord admin, show admin panel directly
    if (isDiscordAdmin) {
        showPanel(document.getElementById('admin-panel'));
    }

    // Admin sign in
    const adminSignInForm = document.getElementById('admin-signin-form');
    if (adminSignInForm) {
        adminSignInForm.onsubmit = async function(e) {
            e.preventDefault();
            const password = document.getElementById('admin-signin-password').value;
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await res.json();
            if (data.success) {
                showPanel(document.getElementById('admin-panel'));
            } else {
                document.getElementById('admin-signin-message').textContent = data.error || 'Login failed';
            }
        };
    }

    // Admin panel logic
    async function fetchUser(username, userId) {
        const q = userId || username;
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        const users = await res.json();
        return users && users.length ? users[0] : null;
    }
    function renderAdminUser(user) {
        document.getElementById('admin-notes-list').innerHTML = (user.notes || []).map((note, i) => `
            <li>
                <span>${note}</span>
                <button type="button" onclick="editAdminNote(${i})">Edit</button>
                <button type="button" onclick="deleteAdminNote(${i})">Delete</button>
            </li>
        `).join('');
        document.getElementById('admin-apps-list').innerHTML = (user.applications || []).map((app, i) => `
            <li>
                <span><b>${app.status ? app.status.toUpperCase() : ''}</b> - ${app.reason || ''} ${app.date ? '(' + new Date(app.date).toLocaleString() + ')' : ''}</span>
                <button type="button" onclick="editAdminApp(${i})">Edit</button>
                <button type="button" onclick="deleteAdminApp(${i})">Delete</button>
            </li>
        `).join('');
    }
    async function loadAdminUser() {
        const username = document.getElementById('admin-username').value.trim();
        const userId = document.getElementById('admin-userid').value.trim();
        if (!username && !userId) return;
        const user = await fetchUser(username, userId);
        if (user) {
            document.getElementById('admin-notes').value = Array.isArray(user.notes) ? user.notes.join(', ') : (user.notes || '');
            renderAdminUser(user);
            window._adminUser = user;
        } else {
            document.getElementById('admin-notes').value = '';
            document.getElementById('admin-notes-list').innerHTML = '';
            document.getElementById('admin-apps-list').innerHTML = '';
            window._adminUser = null;
        }
    }
    window.editAdminNote = async function(idx) {
        const user = window._adminUser;
        const newNote = prompt("Edit note:", user.notes[idx]);
        if (newNote === null) return;
        await fetch('/api/users/edit-note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.userId, noteIndex: idx, newNote })
        });
        loadAdminUser();
    };
    window.deleteAdminNote = async function(idx) {
        const user = window._adminUser;
        if (!confirm("Delete this note?")) return;
        await fetch('/api/users/delete-note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.userId, noteIndex: idx, reason: "Admin deleted" })
        });
        loadAdminUser();
    };
    window.editAdminApp = async function(idx) {
        const user = window._adminUser;
        const app = user.applications[idx];
        const newStatus = prompt("Edit status (Pass/Fail):", app.status);
        if (newStatus === null) return;
        const newReason = prompt("Edit reason:", app.reason);
        if (newReason === null) return;
        await fetch('/api/users/edit-app', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.userId, appIndex: idx, newStatus, newReason })
        });
        loadAdminUser();
    };
    window.deleteAdminApp = async function(idx) {
        const user = window._adminUser;
        if (!confirm("Delete this application entry?")) return;
        await fetch('/api/users/delete-app', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.userId, appIndex: idx, reason: "Admin deleted" })
        });
        loadAdminUser();
    };
    document.getElementById('admin-username').addEventListener('blur', loadAdminUser);
    document.getElementById('admin-userid').addEventListener('blur', loadAdminUser);
    document.getElementById('admin-form').onsubmit = async function(e) {
        e.preventDefault();
        const username = document.getElementById('admin-username').value;
        const userId = document.getElementById('admin-userid').value;
        const notes = document.getElementById('admin-notes').value.split(',').map(n => n.trim()).filter(Boolean);
        const appStatus = document.getElementById('admin-app-status').value;
        const appReason = document.getElementById('admin-app-reason').value;
        await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, userId, notes, appStatus, appReason })
        });
        loadAdminUser();
        document.getElementById('admin-message').textContent = 'User saved!';
        document.getElementById('admin-form').reset();
    };

    // Search logic
    document.getElementById('search-form').onsubmit = async function(e) {
        e.preventDefault();
        const q = document.getElementById('search-query').value.trim();
        if (!q) return;
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        const users = await res.json();
        const searchResults = document.getElementById('search-results');
        if (!users.length) {
            searchResults.textContent = 'No user found.';
            return;
        }
        const user = users[0];
        let html = `<strong>Username:</strong> ${user.username}<br>`;
        html += `<strong>User ID:</strong> ${user.userId}<br>`;
        html += `<strong>Notes:</strong> <ul>${(user.notes||[]).map(n => `<li>${n}</li>`).join('')}</ul>`;
        if (user.applications && user.applications.length > 0) {
            html += `<strong>Applications:</strong><ul>`;
            user.applications.forEach((app, i) => {
                html += `<li>#${i + 1}: <b>${app.status ? app.status.toUpperCase() : ''}</b> - ${app.reason || ''} ${app.date ? '(' + new Date(app.date).toLocaleString() + ')' : ''}</li>`;
            });
            html += `</ul>`;
        } else {
            html += `<strong>Applications:</strong> None<br>`;
        }
        searchResults.innerHTML = html;
    };
});
