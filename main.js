document.addEventListener('DOMContentLoaded', async function() {
    // UI elements
    const mainContent = document.getElementById('main-content');
    const adminPanel = document.getElementById('admin-panel');
    const searchPanel = document.getElementById('search-panel');
    const adminLink = document.getElementById('admin-link');
    const searchLink = document.getElementById('search-link');
    const discordLoginDiv = document.getElementById('discord-login');
    const adminForm = document.getElementById('admin-form');
    const discordLoginBtn = document.getElementById('discord-login-btn');
    const adminSignInBtn = document.getElementById('admin-signin-btn');
    const adminSignInPanel = document.getElementById('admin-signin-panel');
    const adminSignInForm = document.getElementById('admin-signin-form');
    const adminSignInMessage = document.getElementById('admin-signin-message');
    // Logs button and panel
    let logsBtn = document.getElementById('logs-btn');
    let logsPanel = document.getElementById('logs-panel');
    if (!logsBtn) {
        logsBtn = document.createElement('button');
        logsBtn.id = 'logs-btn';
        logsBtn.textContent = 'Logs';
        logsBtn.style.display = 'none';
        logsBtn.style.marginLeft = '1em';
        document.querySelector('nav').appendChild(logsBtn);
    }
    if (!logsPanel) {
        logsPanel = document.createElement('div');
        logsPanel.id = 'logs-panel';
        logsPanel.className = 'container';
        logsPanel.style.display = 'none';
        logsPanel.innerHTML = `<h2>Admin Logs</h2><div id="logs-content"></div><button id="close-logs-btn" style="margin-top:1em;">Close</button>`;
        document.body.appendChild(logsPanel);
    }

    // Helper to show/hide panels
    function showPanel(panel) {
        mainContent.style.display = panel === 'main' ? '' : 'none';
        adminPanel.style.display = panel === 'admin' ? '' : 'none';
        searchPanel.style.display = panel === 'search' ? '' : 'none';
        if (adminSignInPanel) adminSignInPanel.style.display = panel === 'admin-signin' ? '' : 'none';
        logsPanel.style.display = panel === 'logs' ? '' : 'none';
    }

    // Navigation
    if (searchLink) searchLink.onclick = () => { showPanel('search'); return false; };
    const homeLink = document.querySelector('nav a[href="index.html"]');
    if (homeLink) homeLink.onclick = () => { showPanel('main'); return false; };

    // Discord login button
    if (discordLoginBtn) {
        discordLoginBtn.onclick = () => {
            window.location.href = '/api/auth/discord';
        };
    }

    // Check if user is logged in (fetch from backend)
    let user = null;
    let hasAdminRole = false;
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const data = await res.json();
            user = data;
            hasAdminRole = !!data.hasAdminRole;
        }
    } catch (e) {
        // Not logged in or error
    }

    if (user) {
        // Hide login, show search, show admin link if allowed
        if (discordLoginDiv) discordLoginDiv.style.display = 'none';
        if (adminForm) adminForm.style.display = hasAdminRole ? '' : 'none';
        if (adminLink) adminLink.style.display = hasAdminRole ? '' : 'none';
        showPanel('search');
        // Auto-search for the logged-in user
        const resultsDiv = document.getElementById('search-results');
        if (resultsDiv) {
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(user.userId)}`);
            const users = await res.json();
            if (!users.length) {
                resultsDiv.textContent = 'No user found.';
            } else {
                resultsDiv.innerHTML = users.map(u => `
                    <div class="user-profile">
                        <h3>${u.username} (${u.userId})</h3>
                        <strong>Notes:</strong>
                        <ul>${(u.notes||[]).map(n => `<li>${n}</li>`).join('')}</ul>
                        <strong>Applications:</strong>
                        <ul>${(u.applications||[]).map(a => `<li>${a.status} - ${a.reason} (${a.date ? new Date(a.date).toLocaleString() : ''})</li>`).join('')}</ul>
                    </div>
                `).join('');
            }
        }
    } else {
        // Not logged in: show login, hide admin form, show main
        if (discordLoginDiv) discordLoginDiv.style.display = '';
        if (adminForm) adminForm.style.display = 'none';
        if (adminLink) adminLink.style.display = 'none';
        showPanel('main');
    }

    // Admin form submit
    if (adminForm) {
        adminForm.onsubmit = async (e) => {
            e.preventDefault();
            const username = document.getElementById('admin-username').value;
            const userId = document.getElementById('admin-userid').value;
            const notes = document.getElementById('admin-notes').value.split(',').map(n => n.trim()).filter(Boolean);
            const appStatus = document.getElementById('admin-app-status').value;
            const appReason = document.getElementById('admin-app-reason').value;
            const adminPassword = document.getElementById('admin-password') ? document.getElementById('admin-password').value : '';
            const applications = appStatus ? [{ status: appStatus, reason: appReason, date: new Date().toISOString() }] : [];
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, userId, notes, applications, adminPassword })
            });
            const data = await res.json();
            document.getElementById('admin-message').textContent = data.success ? 'User saved!' : (data.error || 'Error');
            adminForm.reset();
        };
    }

    // Search form submit
    const searchForm = document.getElementById('search-form');
    if (searchForm) {
        searchForm.onsubmit = async (e) => {
            e.preventDefault();
            const q = document.getElementById('search-query').value;
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
            const users = await res.json();
            const resultsDiv = document.getElementById('search-results');
            if (!users.length) {
                resultsDiv.textContent = 'No user found.';
                return;
            }
            resultsDiv.innerHTML = users.map(u => `
                <div class="user-profile">
                    <h3>${u.username} (${u.userId})</h3>
                    <strong>Notes:</strong>
                    <ul>${(u.notes||[]).map(n => `<li>${n}</li>`).join('')}</ul>
                    <strong>Applications:</strong>
                    <ul>${(u.applications||[]).map(a => `<li>${a.status} - ${a.reason} (${a.date ? new Date(a.date).toLocaleString() : ''})</li>`).join('')}</ul>
                </div>
            `).join('');
        };
    }

    let adminSignedIn = false;
    let adminUsername = null;

    if (adminSignInBtn) {
        adminSignInBtn.onclick = () => { showPanel('admin-signin'); };
    }

    if (adminSignInForm) {
        adminSignInForm.onsubmit = async (e) => {
            e.preventDefault();
            const password = document.getElementById('admin-signin-password').value;
            if (password === 'Y$z4@Vq2#Lp1!eMx') {
                adminSignedIn = true;
                adminUsername = prompt("Enter your admin username for logs:", "admin");
                showPanel('admin');
                adminSignInMessage.textContent = '';
                document.getElementById('admin-username-display').textContent = adminUsername || 'admin';
                // Show admin panel and logs button, hide admin sign in button
                if (adminLink) adminLink.style.display = '';
                logsBtn.style.display = '';
                if (adminSignInBtn) adminSignInBtn.style.display = 'none';
                // Optionally, clear the password field
                document.getElementById('admin-signin-password').value = '';
            } else {
                adminSignInMessage.textContent = 'Incorrect password.';
            }
        };
    }

    if (adminLink) {
        adminLink.style.display = 'none';
        adminLink.onclick = () => { showPanel('admin'); return false; };
    }

    // Logs button (only after admin sign in)
    logsBtn.onclick = async () => {
        showPanel('logs');
        // Fetch logs from backend
        const logsContent = document.getElementById('logs-content');
        logsContent.textContent = 'Loading...';
        try {
            const res = await fetch('/api/admin/logs');
            const logs = await res.json();
            if (!logs.length) {
                logsContent.textContent = 'No logs found.';
            } else {
                logsContent.innerHTML = logs.map(log => `
                    <div class="log-entry" style="border-bottom:1px solid #ccc; margin-bottom:1em; padding-bottom:1em;">
                        <div><strong>Time:</strong> ${new Date(log.timestamp).toLocaleString()}</div>
                        <div><strong>Action:</strong> ${log.action}</div>
                        <div><strong>User ID:</strong> ${log.userId}</div>
                        <div><strong>Admin:</strong> ${log.admin}</div>
                        <div><strong>Changes:</strong>
                            <pre style="background:#f4f4f4; padding:0.5em; border-radius:4px;">${JSON.stringify(log.changes, null, 2)}</pre>
                        </div>
                    </div>
                `).join('');
            }
        } catch {
            logsContent.textContent = 'Failed to load logs.';
        }
    };

    // Close logs panel
    document.body.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'close-logs-btn') {
            showPanel('admin');
        }
    });

    // Admin form submit
    if (adminForm) {
        adminForm.onsubmit = async (e) => {
            e.preventDefault();
            const username = document.getElementById('admin-username').value;
            const userId = document.getElementById('admin-userid').value;
            const notes = document.getElementById('admin-notes').value.split(',').map(n => n.trim()).filter(Boolean);
            const appStatus = document.getElementById('admin-app-status').value;
            const appReason = document.getElementById('admin-app-reason').value;
            const adminPassword = document.getElementById('admin-password') ? document.getElementById('admin-password').value : '';
            const applications = appStatus ? [{ status: appStatus, reason: appReason, date: new Date().toISOString() }] : [];
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, userId, notes, applications, adminPassword, adminUsername })
            });
            const data = await res.json();
            document.getElementById('admin-message').textContent = data.success ? 'User saved!' : (data.error || 'Error');
            adminForm.reset();
        };
    }
});
