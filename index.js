import { 
    makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore, 
    DisconnectReason,
    Browsers
} from 'todleys';
import P from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createInterface } from 'readline';
import chalk from 'chalk';
import CFonts from 'cfonts';

import { config } from './config.js';
import { logger } from './config/print.js';
import { loadAllSubBots } from './sockets/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

global.commands = {};
let startTime = Date.now();

const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

global.loadCommands = async () => {
    const commandsPath = path.resolve(__dirname, 'comandos');
    if (!fs.existsSync(commandsPath)) fs.mkdirSync(commandsPath);
    
    const files = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of files) {
        try {
            const filePath = path.join(commandsPath, file);
            const fileUrl = pathToFileURL(filePath).href;
            const module = await import(`${fileUrl}?update=${Date.now()}`);
            const handler = module.default || module;
            
            if (handler && handler.command) {
                global.commands[file] = handler;
            }
        } catch (e) {}
    }
};

async function startBot() {
    const sessionDir = './session_base';
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        printQRInTerminal: false,
        logger: P({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' })),
        },
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: true
    });

    await global.loadCommands();

    if (!conn.authState.creds.registered) {
        setTimeout(async () => {
            let input = await question(chalk.white('\n  [?] Ingresa el número para vincular (Ej: 535xxx):\n  > '));
            let phoneNumber = input.replace(/[^0-9]/g, '');
            try {
                let code = await conn.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(chalk.black.bgWhite(`\n  CÓDIGO DE VINCULACIÓN: ${code}  \n`));
            } catch (error) {}
        }, 3000);
    }

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                startBot();
            } else {
                process.exit();
            }
        } else if (connection === 'open') {
            process.stdout.write('\x1Bc');
            CFonts.say('BASE-BOT', { font: 'block', align: 'center', colors: ['white', 'cyan'] });
            console.log(chalk.white.bold(`\n  [✨] BaseBot conectado correctamente.\n  [⌚] Tiempo de inicio: ${((Date.now() - startTime) / 1000).toFixed(2)}s`));
            await loadAllSubBots(conn);
        }
    });

    conn.ev.on('messages.upsert', async (chatUpdate) => {
        const m = chatUpdate.messages[0];
        if (!m || !m.message) return;
        if (m.key.remoteJid === 'status@broadcast') return;

        m.chat = m.key.remoteJid;
        m.sender = conn.decodeJid ? conn.decodeJid(m.key.participant || m.key.remoteJid) : (m.key.participant || m.key.remoteJid);
        
        logger(m, conn);

        const body = (
            m.message.conversation || 
            m.message.extendedTextMessage?.text || 
            m.message.imageMessage?.caption || ""
        ).trim();

        const prefixes = config.allPrefixes || ['#', '!', '.'];
        const usedPrefix = prefixes.find(p => body.startsWith(p)) || '';
        const isCommand = body.startsWith(usedPrefix);
        const commandText = isCommand ? body.slice(usedPrefix.length).trim().split(/ +/).shift().toLowerCase() : '';

        m.reply = async (text) => conn.sendMessage(m.chat, { text }, { quoted: m });

        for (let name in global.commands) {
            let plugin = global.commands[name];
            if (!plugin) continue;

            const isMatch = Array.isArray(plugin.command) 
                ? plugin.command.includes(commandText) 
                : plugin.command instanceof RegExp 
                    ? plugin.command.test(commandText) 
                    : plugin.command === commandText;

            if (isMatch && isCommand) {
                try {
                    await plugin(m, { conn, usedPrefix, command: commandText });
                } catch (e) {
                    console.error(e);
                }
            }
        }
    });
}

startBot();