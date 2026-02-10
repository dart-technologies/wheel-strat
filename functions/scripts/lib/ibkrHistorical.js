const fs = require('fs');
const path = require('path');

const compiledPath = path.resolve(__dirname, '../../lib/functions/src/lib/ibkrHistorical.js');

if (!fs.existsSync(compiledPath)) {
    throw new Error('Missing compiled functions. Run: yarn workspace functions run build');
}

// eslint-disable-next-line global-require, import/no-dynamic-require
module.exports = require(compiledPath);
