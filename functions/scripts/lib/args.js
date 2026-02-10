function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i += 1) {
        const key = argv[i];
        if (!key.startsWith('--')) continue;
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) {
            args[key.slice(2)] = true;
            continue;
        }
        args[key.slice(2)] = value;
        i += 1;
    }
    return args;
}

function parseBoolean(value, fallback) {
    if (value === undefined) return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    return fallback;
}

function parseNumber(value, fallback) {
    if (!value) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSymbols(input) {
    if (!input) return null;
    if (Array.isArray(input)) {
        const normalized = input
            .map((value) => String(value).trim().toUpperCase())
            .filter(Boolean);
        return normalized.length ? normalized : null;
    }
    if (typeof input === 'string') {
        const normalized = input
            .split(',')
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean);
        return normalized.length ? normalized : null;
    }
    return null;
}

module.exports = {
    parseArgs,
    parseBoolean,
    parseNumber,
    normalizeSymbols
};
