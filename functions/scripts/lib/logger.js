const LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

function resolveLevel(raw) {
    if (!raw) return LEVELS.info;
    const normalized = String(raw).trim().toLowerCase();
    if (normalized in LEVELS) return LEVELS[normalized];
    return LEVELS.info;
}

function createLogger(prefix) {
    const level = resolveLevel(process.env.LOG_LEVEL);
    const prefixLabel = prefix ? `[${prefix}]` : '';

    const write = (label, ...args) => {
        if (prefixLabel) {
            console.log(prefixLabel, label, ...args);
        } else {
            console.log(label, ...args);
        }
    };

    return {
        debug: (...args) => {
            if (level <= LEVELS.debug) write('[debug]', ...args);
        },
        info: (...args) => {
            if (level <= LEVELS.info) write('[info]', ...args);
        },
        warn: (...args) => {
            if (level <= LEVELS.warn) write('[warn]', ...args);
        },
        error: (...args) => {
            if (level <= LEVELS.error) write('[error]', ...args);
        }
    };
}

module.exports = {
    createLogger
};
