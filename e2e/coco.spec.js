import { test, expect } from '@playwright/test';

test.describe('COCO Dataset UI', () => {
  test('should display COCO UI elements and controls', async ({ page }) => {
    // Navigate to the application
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for app to be ready
    await expect(page.locator('.sidebar h2:text("notato")')).toBeVisible({ timeout: 10000 });

    // Verify COCO load button is present
    await expect(page.locator('#loadCocoBtn')).toBeVisible();

    // Verify class selector is present
    await expect(page.locator('#classSelector')).toBeVisible();

    // Verify class list container is present
    await expect(page.locator('#classList')).toBeVisible();

    // Verify file list is present
    await expect(page.locator('#fileList')).toBeVisible();

    // Verify initial empty state
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('text=No folder loaded')).toBeVisible();

    // Verify canvas container is present
    await expect(page.locator('#canvasContainer')).toBeVisible();

    // Verify toolbar buttons work
    await expect(page.locator('#zoomInBtn')).toBeEnabled();
    await expect(page.locator('#zoomOutBtn')).toBeEnabled();

    // Take a screenshot
    await page.screenshot({ path: 'e2e/screenshots/coco-ui.png', fullPage: true });
  });

  test('should have functional zoom controls', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for app and zoom controls
    await expect(page.locator('#zoomLevel')).toBeVisible();

    // Verify zoom level is displayed (default 100%)
    const zoomText = await page.locator('#zoomLevel').textContent();
    expect(zoomText).toContain('%');

    // Verify all zoom buttons are present
    await expect(page.locator('#zoomInBtn')).toBeVisible();
    await expect(page.locator('#zoomOutBtn')).toBeVisible();
    await expect(page.locator('#fitToScreenBtn')).toBeVisible();
    await expect(page.locator('#toggleBoxesBtn')).toBeVisible();
  });
});
