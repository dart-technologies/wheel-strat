const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.resolve(__dirname, '../../assets/data');
const TARGET_DIR = path.resolve(__dirname, '../assets/data');

console.log(`📂 Preparing assets for deployment...`);

if (!fs.existsSync(SOURCE_DIR)) {
    console.warn(`⚠️ Source assets directory not found: ${SOURCE_DIR}`);
    process.exit(0); // Warn but don't fail build if missing locally
}

if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

const files = fs.readdirSync(SOURCE_DIR);

files.forEach(file => {
    const src = path.join(SOURCE_DIR, file);
    const dest = path.join(TARGET_DIR, file);

    if (fs.lstatSync(src).isFile()) {
        fs.copyFileSync(src, dest);
        console.log(`✅ Copied ${file} to functions/assets/data`);
    }
});
