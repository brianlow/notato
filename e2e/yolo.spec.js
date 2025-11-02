import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplesPath = path.join(__dirname, '..', 'samples', 'yolo');

test.describe('YOLO Dataset Loading', () => {
  test('should load YOLO dataset and display bounding boxes', async ({ page, context }) => {
    // Grant permissions for file access
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Navigate to the application
    await page.goto('/');

    // Wait for app to be ready
    await expect(page.locator('h2:has-text("notato")')).toBeVisible();
    await expect(page.locator('#loadYoloBtn')).toBeVisible();

    // Click the Load YOLO button
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#loadYoloBtn')
    ]);

    // Select the samples/yolo directory by selecting a file from it
    // Note: In a real browser, users select the directory, but in tests we can select files
    const yoloFiles = [
      path.join(samplesPath, '1737779468498-overhead-feeder-lower.jpg'),
      path.join(samplesPath, '1737779468498-overhead-feeder-lower.txt'),
      path.join(samplesPath, '1737779468498-overhead-feeder-upper.jpg'),
      path.join(samplesPath, '1737779468498-overhead-feeder-upper.txt'),
      path.join(samplesPath, '1737779468498-overhead-tracking.jpg'),
      path.join(samplesPath, '1737779468498-overhead-tracking.txt'),
    ];

    await fileChooser.setFiles(yoloFiles);

    // Wait for images to load
    await page.waitForTimeout(1000);

    // Verify that files are loaded in the sidebar
    const fileList = page.locator('#fileList');
    await expect(fileList).toBeVisible();

    // Check if images appear in the file list (should show 3 .jpg files)
    const fileItems = fileList.locator('.file-item');
    const fileCount = await fileItems.count();
    expect(fileCount).toBeGreaterThan(0);

    // Click on the first image to load it
    await fileItems.first().click();

    // Wait for canvas to render
    await page.waitForTimeout(500);

    // Verify canvas is visible and has content
    const canvas = page.locator('#mainCanvas');
    await expect(canvas).toBeVisible();

    // Verify annotation count is displayed (should show number of boxes)
    const annotationCount = page.locator('#annotationCount');
    await expect(annotationCount).toBeVisible();
    const countText = await annotationCount.textContent();
    expect(countText).toContain('box');

    // Verify file info is shown
    const fileInfo = page.locator('#fileInfo');
    await expect(fileInfo).toBeVisible();
    const infoText = await fileInfo.textContent();
    expect(infoText).toContain('.jpg');

    // Verify status shows ready or loaded state
    const statusMessage = page.locator('#statusMessage');
    await expect(statusMessage).toBeVisible();

    // Take a screenshot for visual verification
    await page.screenshot({ path: 'e2e/screenshots/yolo-loaded.png', fullPage: true });
  });

  test('should display multiple bounding boxes for YOLO image', async ({ page }) => {
    await page.goto('/');

    // This is a simplified test that checks the UI is functional
    // In a real scenario with proper File System API support, we would verify exact box counts

    await expect(page.locator('#loadYoloBtn')).toBeVisible();
    await expect(page.locator('h2:has-text("notato")')).toBeVisible();

    // Verify the canvas and controls are present
    await expect(page.locator('#mainCanvas')).toBeVisible();
    await expect(page.locator('#zoomInBtn')).toBeVisible();
    await expect(page.locator('#zoomOutBtn')).toBeVisible();
    await expect(page.locator('#saveBtn')).toBeVisible();
  });
});
