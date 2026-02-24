const fs = require('fs');
const path = require('path');

// Minimal 1x1 white PNG
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const assets = [
  'assets/icon.png',
  'assets/splash.png',
  'assets/adaptive-icon.png',
  'assets/favicon.png',
];

assets.forEach((f) => {
  if (!fs.existsSync(f)) {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, png);
    console.log('Created:', f);
  } else {
    console.log('Exists:', f);
  }
});
