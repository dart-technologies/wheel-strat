const http = require('http');

const BRIDGE_URL = 'http://localhost:5050';
const SYMBOL = 'AMZN';

function fetchJson(path, options = {}) {
    return new Promise((resolve, reject) => {
        const reqOpts = {
            hostname: 'localhost',
            port: 5050,
            path: path,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = http.request(reqOpts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        req.end();
    });
}

async function testDuration(duration, barSize) {
    console.log(`\nTesting duration: ${duration}, Bar: ${barSize}...`);
    try {
        const historyPath = path.join(__dirname, '../../assets/data/mag7_history.json');
        const res = await fetchJson('/historical', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {
                symbol: SYMBOL,
                duration: duration,
                barSize: barSize
            }
        });

        if (res.status === 200 && res.data.bars) {
            const bars = res.data.bars;
            console.log(`✅ Success! Received ${bars.length} bars.`);
            if (bars.length > 0) {
                console.log(`   Range: ${bars[0].date} to ${bars[bars.length - 1].date}`);
            }
            return true;
        } else {
            console.log(`❌ Failed: ${res.data.error || 'Unknown error'}`);
            return false;
        }
    } catch (e) {
        console.log(`❌ Error: ${e.message}`);
        return false;
    }
}

async function testOptionChain() {
    console.log(`\nTesting Option Chain for ${SYMBOL}...`);
    try {
        const res = await fetchJson(`/option-chain/${SYMBOL}`);
        if (res.status === 200 && res.data.expirations) {
            console.log(`✅ Success!`);
            console.log(`   Expirations: ${res.data.expirations.length} found (Next 12)`);
            console.log(`   First Expiration: ${res.data.expirations[0]}`);
            console.log(`   Last Expiration: ${res.data.expirations[res.data.expirations.length - 1]}`);
            console.log(`   Strikes: ${res.data.strikes.length} found`);
            console.log(`   Strike Range: ${res.data.strikes[0]} - ${res.data.strikes[res.data.strikes.length - 1]}`);
        } else {
            console.log(`❌ Failed: ${res.data.error || 'Unknown error'}`);
        }
    } catch (e) {
        console.log(`❌ Error: ${e.message}`);
    }
}

async function run() {
    console.log(`Starting IBKR Data Capability Test for ${SYMBOL}`);
    console.log('='.repeat(50));

    // Test Historical Durations
    await testDuration('1 Y', '1 day');
    await testDuration('5 Y', '1 day');
    await testDuration('10 Y', '1 week'); // IBKR might timeout purely on size, so trying different bar sizes
    await testDuration('10 Y', '1 month');

    // Test specific date range (End of 2024 to now)
    // await testDuration('2 M', '1 day'); 

    // Test Option Chain
    await testOptionChain();
}

run();
