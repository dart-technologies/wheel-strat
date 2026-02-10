const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const resolveEnvPath = (cwd, envPath) => (
    path.isAbsolute(envPath) ? envPath : path.join(cwd, envPath)
);

const loadEnv = (options = {}) => {
    const cwd = options.cwd || process.cwd();
    const explicitEnvFile = process.env.IBKR_BRIDGE_ENV_FILE || process.env.BRIDGE_ENV_FILE;
    const candidates = [];

    if (explicitEnvFile) {
        candidates.push(resolveEnvPath(cwd, explicitEnvFile));
    } else if (Array.isArray(options.files)) {
        options.files.forEach((file) => candidates.push(resolveEnvPath(cwd, file)));
    } else {
        candidates.push(path.join(cwd, '.env'));
        candidates.push(path.join(cwd, '.env.local'));
    }

    const loaded = [];
    candidates.forEach((candidate, index) => {
        if (!fs.existsSync(candidate)) return;
        dotenv.config({ path: candidate, override: index > 0 });
        loaded.push(path.basename(candidate));
    });

    return loaded;
};

module.exports = {
    loadEnv
};
