const fs = require('fs');
const chalk = require('chalk');

global.botname = 'BaseBot-CJS';
global.owner = [
  ['535xxxxxx', 'Dev-FelixOfc', true]
];

global.prefix = /^[./#!]/;

global.settings = {
  name: 'BaseBot-CJS',
  limit: 20,
  admin: '*[ ADVERTENCIA ]* Este comando solo puede ser utilizado por administradores del grupo.',
  group: '*[ ADVERTENCIA ]* Este comando solo es funcional dentro de grupos.',
  owner: '*[ ADVERTENCIA ]* Este comando es exclusivo para el dueño del bot.',
  botAdmin: '*[ ADVERTENCIA ]* Para ejecutar este comando, el bot debe ser administrador.',
  error: '*[ ERROR ]* Algo salió mal, intenta de nuevo más tarde.'
};

global.desc = {
  menu: 'Lista de comandos disponibles',
  subbot: 'Conviértete en un subbot temporal',
  antilink: 'Activa o desactiva el filtro de enlaces'
};

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.cyanBright(`[ UPDATE ] 'settings.js' ha sido actualizado.`));
  delete require.cache[file];
  require(file);
});