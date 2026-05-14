module.exports = {
    command: ['menu', 'help', 'comandos'],
    exec: async (m, { conn, prefix, pushname }) => {
        let texto = `Hola *${pushname}*, bienvenido a *${global.botname}*\n\n`;
        texto += `┌──『 *INFO USER* 』\n`;
        texto += `│ 📋 *Prefix:* [ ${prefix} ]\n`;
        texto += `└──────────────\n\n`;
        texto += `┌──『 *LISTA DE COMANDOS* 』\n`;

        const categorias = {
            'Sin Categoría': []
        };

        for (let file in global.plugins) {
            const plugin = global.plugins[file];
            if (!plugin.command) continue;

            const name = Array.isArray(plugin.command) ? plugin.command[0] : plugin.command;
            const category = plugin.category || 'Sin Categoría';

            if (!categorias[category]) categorias[category] = [];
            categorias[category].push(name);
        }

        for (let cat in categorias) {
            if (categorias[cat].length === 0) continue;
            texto += `│\n│── *${cat.toUpperCase()}*\n`;
            for (let cmd of categorias[cat]) {
                texto += `│ 🔹 ${prefix}${cmd}\n`;
            }
        }

        texto += `└──────────────`;

        await m.reply(texto);
    }
};