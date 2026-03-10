import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'src', 'useHologramViewer.js');
let content = fs.readFileSync(filePath, 'utf8');
content = content.split('\\r\\n').join('\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed newlines.');
