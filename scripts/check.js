const { readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
for (const folder of ['src', 'media', 'scripts']) {
  for (const name of readdirSync(folder).filter(name => name.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--check', `${folder}/${name}`], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
