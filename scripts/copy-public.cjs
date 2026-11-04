const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../src/public');
const destDir = path.resolve(__dirname, '../dist/public');

if (fs.existsSync(srcDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.cpSync(srcDir, destDir, { recursive: true });
  console.log('✅ Copied src/public to dist/public');
}
