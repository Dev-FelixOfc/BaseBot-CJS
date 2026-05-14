import { 
    makeWASocket, 
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore, 
    DisconnectReason,
    Browsers 
} from 'todleys';
import P from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!global.conns) global.conns = new Map();

export async function loadAllSubBots(mainConn) {
    const subbotsDir = path.join(__dirname, '../subbots_sessions');
    if (!fs.existsSync(subbotsDir)) fs.mkdirSync(subbotsDir, { recursive: true });

    const folders = fs.readdirSync(subbotsDir).filter(f => fs.statSync(path.join(subbotsDir, f)).isDirectory());

    for (const folder of folders) {
        await startSubBot(folder, mainConn);
    }
}

export async function startSubBot(id, mainConn) {
    const sessionPath = path.join(__dirname, `../subbots_sessions/${id}`);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const conn = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' })),
        },
        printQRInTerminal: false,
        logger: P({ level: 'silent' }),
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: true
    });

    conn._subbotContext = {
        botName: `AkinaWa-SubBot (${id})`,
        subbotId: id,
        mainJid: mainConn.user.id
    };

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            global.conns.set(id, conn);
            console.log(chalk.cyanBright(`[SUBBOT] ID: ${id} conectado exitosamente.`));
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                startSubBot(id, mainConn);
            } else {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                global.conns.delete(id);
            }
        }
    });

    conn.ev.on('messages.upsert', async (chatUpdate) => {
        const m = chatUpdate.messages[0];
        if (!m || !m.message) return;
        
        const mainUpsert = mainConn.ev.emit.bind(mainConn.ev);
        mainConn.ev.emit('messages.upsert', { 
            messages: [m], 
            type: chatUpdate.type, 
            isSubbot: true, 
            subbotConn: conn 
        });
    });

    return conn;
}