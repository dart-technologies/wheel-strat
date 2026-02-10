const { spawn, spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const composeFile = path.join(projectRoot, 'infrastructure', 'docker-compose.yml');

function resolveDockerCompose() {
    const candidates = [
        { cmd: 'docker', args: ['compose'] },
        { cmd: 'docker-compose', args: [] },
    ];

    for (const candidate of candidates) {
        const probe = spawnSync(candidate.cmd, [...candidate.args, 'version'], { stdio: 'ignore' });
        if (probe.status === 0) {
            return candidate;
        }
    }

    console.error('[dev-env] Docker Compose not found. Install Docker Desktop or add docker-compose to PATH.');
    process.exit(1);
}

function runDockerCompose(services) {
    const compose = resolveDockerCompose();
    const args = [...compose.args, '-f', composeFile, 'up', '-d', ...services];
    const result = spawnSync(compose.cmd, args, { stdio: 'inherit' });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

console.log('[dev-env] Starting docker services (ib-gateway, novnc)...');
runDockerCompose(['ib-gateway', 'novnc']);

console.log('[dev-env] Starting IBKR Flask bridge...');
const bridgeProcess = spawn('python3', [path.join(projectRoot, 'scripts', 'bridge', 'ibkr_bridge.py')], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
});

console.log('[dev-env] Starting Expo dev server...');
const expoProcess = spawn('yarn', ['start'], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
});

let shuttingDown = false;
function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[dev-env] Shutting down (${signal})...`);
    bridgeProcess.kill('SIGINT');
    expoProcess.kill('SIGINT');
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

[bridgeProcess, expoProcess].forEach((child) => {
    child.on('exit', (code) => {
        if (shuttingDown) return;
        console.error(`[dev-env] Process exited with code ${code ?? 'unknown'}. Shutting down.`);
        shutdown('process-exit');
    });
});
