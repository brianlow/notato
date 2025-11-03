import { test, expect } from '@playwright/test';

test.describe('YOLO Dataset UI', () => {
  test('should display YOLO UI elements and controls', async ({ page }) => {
    // Navigate to the application
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for app to be ready
    await expect(page.locator('.sidebar h2:text("notato")')).toBeVisible({ timeout: 10000 });

    // Verify YOLO load button is present
    await expect(page.locator('#loadYoloBtn')).toBeVisible();

    // Verify COCO load button is present
    await expect(page.locator('#loadCocoBtn')).toBeVisible();

    // Verify the canvas is present
    await expect(page.locator('#mainCanvas')).toBeVisible();

    // Verify toolbar controls are present
    await expect(page.locator('#zoomInBtn')).toBeVisible();
    await expect(page.locator('#zoomOutBtn')).toBeVisible();
    await expect(page.locator('#fitToScreenBtn')).toBeVisible();
    await expect(page.locator('#saveBtn')).toBeVisible();

    // Verify sidebar sections are present
    await expect(page.locator('.class-section')).toBeVisible();
    await expect(page.locator('.file-section')).toBeVisible();

    // Verify empty state is shown
    await expect(page.locator('.empty-state')).toBeVisible();

    // Take a screenshot
    await page.screenshot({ path: 'e2e/screenshots/yolo-ui.png', fullPage: true });
  });

  test('should show empty canvas state with welcome message', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Check welcome message is visible
    await expect(page.locator('.empty-canvas-state')).toBeVisible();
    await expect(page.locator('text=Welcome to notato')).toBeVisible();

    // Verify file info shows "No image loaded"
    await expect(page.locator('#fileInfo:text("No image loaded")')).toBeVisible();

    // Verify status is ready
    await expect(page.locator('#statusMessage')).toBeVisible();
  });
});
