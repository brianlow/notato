/**
 * Simple syntax validation test
 */

const fs = require('fs');

console.log('Testing JavaScript syntax...\n');

const jsFiles = [
    'src/js/YOLOHandler.js',
    'src/js/COCOHandler.js',
    'src/js/AnnotationStore.js',
    'src/js/FileManager.js',
    'src/js/ImageCanvas.js',
    'src/js/BoxEditor.js',
    'src/js/UIController.js',
    'src/js/main.js'
];

let hasErrors = false;

jsFiles.forEach(file => {
    try {
        const code = fs.readFileSync(file, 'utf8');

        // Try to parse with Function constructor to check syntax
        new Function(code);

        console.log(`✓ ${file} - Syntax OK`);
    } catch (error) {
        console.error(`✗ ${file} - Syntax Error:`);
        console.error(`  ${error.message}`);
        hasErrors = true;
    }
});

console.log('\n---');

if (!hasErrors) {
    console.log('✓ All files passed syntax validation!');
} else {
    console.log('✗ Some files have syntax errors');
    process.exit(1);
}
