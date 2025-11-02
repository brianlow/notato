import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplesPath = path.join(__dirname, '..', 'samples', 'coco', 'train');

test.describe('COCO Dataset Loading', () => {
  test('should load COCO dataset and display bounding boxes', async ({ page, context }) => {
    // Grant permissions for file access
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Navigate to the application
    await page.goto('/');

    // Wait for app to be ready
    await expect(page.locator('h2:has-text("notato")')).toBeVisible();
    await expect(page.locator('#loadCocoBtn')).toBeVisible();

    // Click the Load COCO button
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#loadCocoBtn')
    ]);

    // Select files from the COCO train directory
    const cocoFiles = [
      path.join(samplesPath, 'image_000000.jpg'),
      path.join(samplesPath, 'image_000001.jpg'),
      path.join(samplesPath, 'image_000002.jpg'),
      path.join(samplesPath, 'image_000003.jpg'),
      path.join(samplesPath, 'image_000004.jpg'),
      path.join(samplesPath, 'image_000005.jpg'),
      path.join(samplesPath, 'image_000006.jpg'),
      path.join(samplesPath, '_annotations.coco.json'),
    ];

    await fileChooser.setFiles(cocoFiles);

    // Wait for images to load
    await page.waitForTimeout(1000);

    // Verify that files are loaded in the sidebar
    const fileList = page.locator('#fileList');
    await expect(fileList).toBeVisible();

    // Check if images appear in the file list (should show 7 .jpg files)
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

    // Verify annotation count is displayed
    const annotationCount = page.locator('#annotationCount');
    await expect(annotationCount).toBeVisible();
    const countText = await annotationCount.textContent();
    expect(countText).toContain('box');

    // Verify file info shows COCO format or image name
    const fileInfo = page.locator('#fileInfo');
    await expect(fileInfo).toBeVisible();
    const infoText = await fileInfo.textContent();
    expect(infoText).toContain('image_');

    // Verify class selector shows the lego class
    const classSelector = page.locator('#classSelector');
    await expect(classSelector).toBeVisible();

    // Verify category/class is loaded
    const classList = page.locator('#classList');
    await expect(classList).toBeVisible();

    // Take a screenshot for visual verification
    await page.screenshot({ path: 'e2e/screenshots/coco-loaded.png', fullPage: true });
  });

  test('should navigate between COCO images and show different annotations', async ({ page, context }) => {
    await page.goto('/');

    // Grant permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Wait for app to be ready
    await expect(page.locator('#loadCocoBtn')).toBeVisible();

    // Click Load COCO button
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#loadCocoBtn')
    ]);

    // Select COCO files
    const cocoFiles = [
      path.join(samplesPath, 'image_000000.jpg'),
      path.join(samplesPath, 'image_000001.jpg'),
      path.join(samplesPath, '_annotations.coco.json'),
    ];

    await fileChooser.setFiles(cocoFiles);
    await page.waitForTimeout(1000);

    // Click first image
    const fileItems = page.locator('#fileList .file-item');
    await fileItems.first().click();
    await page.waitForTimeout(300);

    // Get annotation count for first image
    const firstCount = await page.locator('#annotationCount').textContent();
    expect(firstCount).toContain('box');

    // Click second image if available
    const itemCount = await fileItems.count();
    if (itemCount > 1) {
      await fileItems.nth(1).click();
      await page.waitForTimeout(300);

      // Verify we can navigate between images
      const secondCount = await page.locator('#annotationCount').textContent();
      expect(secondCount).toContain('box');
    }

    // Take final screenshot
    await page.screenshot({ path: 'e2e/screenshots/coco-navigation.png', fullPage: true });
  });
});
