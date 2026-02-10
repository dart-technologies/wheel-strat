const path = require('path');
const { spawnSync } = require('child_process');
const { loadEnv } = require('../lib/env');

console.warn('[check_env] Deprecated. Use scripts/diagnostics/validate_ibkr_env.js instead.');

const loaded = loadEnv({ cwd: process.cwd() });
console.log(`Loaded env files: ${loaded.length ? loaded.join(', ') : 'none'}`);

const scriptPath = path.resolve(__dirname, 'validate_ibkr_env.js');
const result = spawnSync(process.execPath, [scriptPath], { stdio: 'inherit' });
process.exit(typeof result.status === 'number' ? result.status : 1);
