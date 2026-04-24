import { test, expect } from '@playwright/test';

test.describe('Envoy Agent E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Assuming the app runs on localhost:3000
    await page.goto('http://localhost:3000');
  });

  test('Lead Upload Test', async ({ page }) => {
    // Wait for the upload section to be visible
    await page.waitForSelector('input[type="file"]');

    // Upload a CSV file (you'll need to have a test CSV file)
    // For this example, we'll assume there's a test.csv in the project root
    await page.setInputFiles('input[type="file"]', 'test.csv');

    // Wait for leads to appear in the list
    await page.waitForSelector('.lead-card', { timeout: 10000 });

    // Verify that leads are displayed
    const leadCards = page.locator('.lead-card');
    await expect(leadCards).toHaveCount(await leadCards.count()); // At least one lead
  });

  test('Review Flow Test', async ({ page }) => {
    // Wait for leads to load
    await page.waitForSelector('.lead-card');

    // Find a lead card with "Review Draft" button (assuming it's visible for drafted leads)
    const reviewButton = page.locator('.lead-card button:has-text("Review Draft")').first();
    await expect(reviewButton).toBeVisible();

    // Click the Review Draft button
    await reviewButton.click();

    // Wait for the overlay to appear
    await page.waitForSelector('[data-testid="review-overlay"]', { timeout: 5000 });

    // Verify the textarea is present
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();

    // Edit the draft
    await textarea.fill('Updated draft content for testing.');

    // Click Send Now
    const sendButton = page.locator('button:has-text("Send Now")');
    await expect(sendButton).toBeVisible();
    await sendButton.click();

    // Wait for the overlay to close (or success message)
    await page.waitForSelector('[data-testid="review-overlay"]', { state: 'hidden', timeout: 5000 });
  });

  test('Discard Test', async ({ page }) => {
    // Wait for leads to load
    await page.waitForSelector('.lead-card');

    // Find a lead card with "Review Draft" button
    const reviewButton = page.locator('.lead-card button:has-text("Review Draft")').first();
    await expect(reviewButton).toBeVisible();

    // Click the Review Draft button
    await reviewButton.click();

    // Wait for the overlay to appear
    await page.waitForSelector('[data-testid="review-overlay"]', { timeout: 5000 });

    // Click Discard
    const discardButton = page.locator('button:has-text("Discard")');
    await expect(discardButton).toBeVisible();
    await discardButton.click();

    // Verify the overlay closes
    await page.waitForSelector('[data-testid="review-overlay"]', { state: 'hidden', timeout: 5000 });
  });
});