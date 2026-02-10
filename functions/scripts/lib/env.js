const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const DEFAULT_ENV_PATHS = [
    path.resolve(__dirname, '../../.env.local'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env.local'),
    path.resolve(__dirname, '../../../.env')
];

function loadEnv(extraPaths = []) {
    const envPaths = [...extraPaths, ...DEFAULT_ENV_PATHS];
    const loaded = [];
    envPaths.forEach((envPath) => {
        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath, override: true });
            loaded.push(envPath);
        }
    });
    return loaded;
}

module.exports = {
    loadEnv
};
