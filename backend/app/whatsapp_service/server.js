const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const app = express();
app.use(cors());
app.use(express.json());

let connectionStatus = 'connecting';
let latestQr = '';
let client = null;
let isRestarting = false;

async function destroyClient() {
    if (client) {
        try { await client.destroy(); } catch (e) { /* ignore */ }
        client = null;
    }
}

async function startClient() {
    if (isRestarting) return;
    isRestarting = true;

    await destroyClient();

    const sessionPath = path.join(__dirname, 'wa_session');
    
    // Clean up SingletonLock file to prevent 'The browser is already running' error
    try {
        const lockPath = path.join(sessionPath, 'session', 'SingletonLock');
        if (fs.existsSync(lockPath)) {
            console.log('🧹 Clearing stale Puppeteer SingletonLock...');
            fs.unlinkSync(lockPath);
        }
    } catch (lockErr) {
        console.warn('Failed to clear lock file:', lockErr.message);
    }

    client = new Client({
        authStrategy: new LocalAuth({ dataPath: sessionPath }),
        webVersionCache: {
            type: 'local'
        },
        qrTimeoutMs: 0,
        puppeteer: {
            headless: 'new',
            protocolTimeout: 60000,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-extensions'
            ]
        }
    });

    // Recursively search and delete any stale lock file in user session directory on startup
    const cleanLocks = (dir) => {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.lstatSync(fullPath).isDirectory()) {
                cleanLocks(fullPath);
            } else if (file === 'SingletonLock') {
                try {
                    fs.unlinkSync(fullPath);
                    console.log(`🧹 Deleted lock file at: ${fullPath}`);
                } catch (e) {}
            }
        }
    };
    try {
        cleanLocks(sessionPath);
    } catch(e) {}

    client.on('qr', async (qr) => {
        console.log('QR code ready - scan with WhatsApp');
        connectionStatus = 'qr';
        try { latestQr = await QRCode.toDataURL(qr); } catch (e) {}
    });

    client.on('ready', () => {
        console.log('WhatsApp READY! Session saved permanently.');
        connectionStatus = 'connected';
        latestQr = '';
        isRestarting = false;
    });

    client.on('authenticated', () => {
        console.log('Authenticated - session stored.');
        connectionStatus = 'connected';
        latestQr = '';
    });

    client.on('auth_failure', async (msg) => {
        console.error('Auth failure:', msg, '- clearing session and requesting fresh QR code');
        connectionStatus = 'disconnected';
        latestQr = '';
        isRestarting = false;
        try {
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log('🧹 Cleaned invalid session directory.');
            }
        } catch (e) {
            console.error('Failed to clean session directory on auth_failure:', e.message);
        }
        setTimeout(startClient, 5000);
    });

    client.on('disconnected', async (reason) => {
        console.log('Disconnected:', reason, '- clearing session and restarting client');
        connectionStatus = 'disconnected';
        latestQr = '';
        isRestarting = false;
        try {
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log('🧹 Cleaned disconnected session directory.');
            }
        } catch (e) {
            console.error('Failed to clean session directory on disconnect:', e.message);
        }
        setTimeout(startClient, 5000);
    });

    try {
        isRestarting = false;
        await client.initialize();
    } catch (err) {
        console.error('Init error:', err.message);
        connectionStatus = 'connecting';
        isRestarting = false;
        setTimeout(startClient, 10000);
    }
}

// Global Uncaught Exception Handlers for Automatic Crash Recovery
process.on('uncaughtException', (err) => {
    console.error('🔥 CRITICAL UNCAUGHT EXCEPTION:', err.message);
    console.error(err.stack);
    
    // Auto-cleanup locks and force exit to let LaunchAgent / KeepAlive system restart the Node app clean
    try {
        const lockPath = path.join(__dirname, 'wa_session', 'session', 'SingletonLock');
        if (fs.existsSync(lockPath)) {
            fs.unlinkSync(lockPath);
            console.log('🧹 Cleaned lock file during crash recovery');
        }
    } catch (e) {}
    
    console.log('🔄 Restarting node server in 5 seconds...');
    setTimeout(() => {
        process.exit(1);
    }, 5000);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 UNHANDLED REJECTION:', reason);
    if (reason && (reason.message || '').includes('detached Frame')) {
        console.log('🔄 Detached Frame detected. Force restarting to recover session...');
        process.exit(1);
    }
});

// Boot
startClient();

// ── Serve QR Code Viewer Interface ───────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Status ────────────────────────────────────────────────
app.get('/status', (req, res) => {
    res.json({ status: connectionStatus, qr: latestQr });
});

// ── Health-check (verifies client is truly alive) ─────────
app.get('/healthcheck', async (req, res) => {
    if (connectionStatus !== 'connected' || !client) {
        return res.json({ healthy: false, status: connectionStatus });
    }
    try {
        const state = await client.getState();
        res.json({ healthy: true, state });
    } catch (err) {
        console.warn('Healthcheck failed - triggering reconnect:', err.message);
        connectionStatus = 'connecting';
        if (!isRestarting) setTimeout(startClient, 3000);
        res.json({ healthy: false, error: err.message });
    }
});

// ── Send message ──────────────────────────────────────────
app.post('/send', async (req, res) => {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'Phone and message required' });
    if (connectionStatus !== 'connected' || !client) {
        return res.status(503).json({ error: 'WhatsApp not connected' });
    }
    try {
        let p = phone.replace(/[^0-9]/g, '');
        if (p.startsWith('07')) p = '964' + p.substring(1);
        else if (p.startsWith('7')) p = '964' + p;
        await client.sendMessage(`${p}@c.us`, message);
        console.log(`✅ Sent to ${p}`);
        res.json({ status: 'success' });
    } catch (err) {
        console.error('Send error:', err.message);
        
        const isSessionError = err.message && (
            err.message.includes('detached') ||
            err.message.includes('Target closed') ||
            err.message.includes('Session closed') ||
            err.message.includes('Protocol error')
        );
        
        if (isSessionError) {
            console.log('🔄 Detached Frame / Protocol error detected during send. Restarting server to clean session...');
            process.exit(1);
        }
        res.status(500).json({ error: err.message });
    }
});

// ── Click-to-Chat (no session needed) ────────────────────
app.get('/click', (req, res) => {
    const { phone, text = '' } = req.query;
    if (!phone) return res.status(400).json({ error: 'phone query param required' });
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('07')) clean = '964' + clean.slice(1);
    else if (clean.startsWith('7')) clean = '964' + clean;
    const url = `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
    res.json({ url });
});

app.listen(8001, () => console.log('WhatsApp gateway on port 8001'));
