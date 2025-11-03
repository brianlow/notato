import { test } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Screenshot for README', () => {
  test('take screenshot of YOLO dataset with most boxes', async ({ page }) => {
    // Set a relatively small window size
    await page.setViewportSize({ width: 1200, height: 800 });

    // Navigate to the application
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for app to be ready
    await page.waitForSelector('.sidebar h2:text("notato")', { timeout: 10000 });

    // Read the YOLO dataset files
    const yoloDir = path.join(process.cwd(), 'datasets/yolo');
    const imageFiles = fs.readdirSync(yoloDir).filter(f => f.endsWith('.jpg'));
    const classesPath = path.join(yoloDir, 'classes.txt');
    const classesContent = fs.readFileSync(classesPath, 'utf8');
    const classes = classesContent.trim().split('\n');

    // Read annotations for each image
    const annotations = {};
    for (const imageFile of imageFiles) {
      const baseName = path.basename(imageFile, '.jpg');
      const txtPath = path.join(yoloDir, `${baseName}.txt`);
      if (fs.existsSync(txtPath)) {
        annotations[imageFile] = fs.readFileSync(txtPath, 'utf8').trim();
      }
    }

    // Inject the dataset into the app
    await page.evaluate(async ({ imageFiles, classes, annotations }) => {
      const app = window.notatoApp;

      // Set YOLO format
      app.store.setFormat('yolo');
      app.currentHandler = app.formatHandlers.get('yolo');

      // Clear the store
      app.store.clear();
      app.currentImageCache.clear();
      app.imageCanvas.clear();

      // Set classes from YOLO data
      app.store.setClasses(classes);

      // Add images to store
      for (const imageFile of imageFiles) {
        const imageId = app.store.addImage({
          fileName: imageFile,
          filePath: imageFile,
          width: 640,
          height: 640
        });

        // Parse YOLO annotations for this image
        const annotationText = annotations[imageFile];
        if (annotationText) {
          const lines = annotationText.split('\n').filter(line => line.trim());
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length === 5) {
              const classId = parseInt(parts[0]);
              const centerX = parseFloat(parts[1]);
              const centerY = parseFloat(parts[2]);
              const width = parseFloat(parts[3]);
              const height = parseFloat(parts[4]);

              // Convert from YOLO format (normalized center) to absolute coordinates
              const imageWidth = 640;
              const imageHeight = 640;
              const x = (centerX - width / 2) * imageWidth;
              const y = (centerY - height / 2) * imageHeight;
              const w = width * imageWidth;
              const h = height * imageHeight;

              app.store.addBox({
                imageId,
                classId,
                x,
                y,
                width: w,
                height: h
              });
            }
          }
        }
      }
    }, { imageFiles, classes, annotations });

    // Load actual image files into cache
    for (let i = 0; i < imageFiles.length; i++) {
      const imagePath = path.join(yoloDir, imageFiles[i]);
      const imageBuffer = fs.readFileSync(imagePath);
      const base64 = imageBuffer.toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64}`;

      await page.evaluate(({ imageIndex, dataUrl }) => {
        const app = window.notatoApp;
        const images = app.store.getAllImages();
        if (images[imageIndex]) {
          app.currentImageCache.set(images[imageIndex].id, dataUrl);
        }
      }, { imageIndex: i, dataUrl });
    }

    // Find which image index has image_1.jpg (the one with most boxes - 10 boxes)
    const targetImageIndex = imageFiles.indexOf('image_1.jpg');

    // Load the image with the most boxes
    await page.evaluate((imageIndex) => {
      const app = window.notatoApp;
      const images = app.store.getAllImages();
      if (images[imageIndex]) {
        app.loadImage(images[imageIndex].id);
      }
    }, targetImageIndex);

    // Wait for image to load
    await page.waitForTimeout(1000);

    // Take screenshot
    const screenshotPath = path.join(process.cwd(), 'images/screenshot.png');
    await page.screenshot({
      path: screenshotPath,
      fullPage: false
    });

    console.log(`Screenshot saved to ${screenshotPath}`);
  });
});
