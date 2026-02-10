const parseArgs = (argv) => {
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
};

module.exports = {
    parseArgs
};
