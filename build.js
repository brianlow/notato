/**
 * build.js
 * Build script to bundle notato into a single HTML file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Building notato...\n');

// Read CSS
console.log('Reading CSS...');
const cssPath = path.join(__dirname, 'src', 'css', 'styles.css');
const css = fs.readFileSync(cssPath, 'utf8');

// Read JavaScript files in order
console.log('Reading JavaScript files...');
const jsFiles = [
    'FormatHandler.js',
    'YOLOHandler.js',
    'COCOHandler.js',
    'NDJSONHandler.js',
    'AnnotationStore.js',
    'FileManager.js',
    'ImageCanvas.js',
    'BoxEditor.js',
    'UIController.js',
    'main.js'
];

const jsContent = jsFiles.map(file => {
    const filePath = path.join(__dirname, 'src', 'js', file);
    console.log(`  - ${file}`);
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove ES6 import statements
    content = content.replace(/^import\s+.*from\s+['"].*['"];?\s*$/gm, '');

    // Remove ES6 export statements
    content = content.replace(/^export\s+default\s+\w+;?\s*$/gm, '');

    // Remove export comments
    content = content.replace(/\/\/\s*Export for ES6 modules\s*$/gm, '');

    return content.trim();
}).join('\n\n');

// Read HTML template
console.log('Reading HTML template...');
const htmlPath = path.join(__dirname, 'src', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Replace placeholders
console.log('Bundling...');

// Remove dev CSS link and inject CSS
html = html.replace(
    /<!-- CSS_PLACEHOLDER -->\s*<link[^>]*>/,
    `<style>\n${css}\n</style>`
);

// Remove dev JS script and inject JS
html = html.replace(
    /<!-- JS_PLACEHOLDER -->\s*<script[^>]*><\/script>/,
    `<script>\n${jsContent}\n</script>`
);

// Write bundled files
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath);
}

const indexPath = path.join(distPath, 'index.html');

fs.writeFileSync(indexPath, html);

// Get file size
const stats = fs.statSync(indexPath);
const fileSizeInBytes = stats.size;
const fileSizeInKB = (fileSizeInBytes / 1024).toFixed(2);

console.log('\n✓ Build complete!');
console.log(`✓ Output: ${indexPath}`);
console.log(`✓ Size: ${fileSizeInKB} KB`);
console.log('\nTo use: Open dist/index.html in a web browser (with a local server)');
