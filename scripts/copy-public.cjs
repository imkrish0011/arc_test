const fs = require('fs');
const path = require('path');

const srcPublic = path.resolve(__dirname, '../src/public');
const destPublic = path.resolve(__dirname, '../dist/public');

if (fs.existsSync(srcPublic)) {
  fs.mkdirSync(destPublic, { recursive: true });
  fs.cpSync(srcPublic, destPublic, { recursive: true, force: true });
  console.log('✅ Copied src/public to dist/public');
}

const srcData = path.resolve(__dirname, '../src/data');
const destData = path.resolve(__dirname, '../dist/data');

if (fs.existsSync(srcData)) {
  fs.mkdirSync(destData, { recursive: true });
  fs.cpSync(srcData, destData, { recursive: true, force: true });
  console.log('✅ Copied src/data to dist/data');
}

