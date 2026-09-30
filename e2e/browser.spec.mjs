import { test, expect } from '@playwright/test';
test('overview renders and is free of browser errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Your town. Your money. An open book.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /2025 town finance report/ })).toBeVisible();
  await page.screenshot({ path: 'artifacts/browser/desktop-overview.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('tax changes reconcile and CSV downloads', async ({ page }) => {
  await page.goto('/#taxes');
  await expect(page.locator('#annual-tax')).toHaveText('$7,566');
  await page.getByLabel('Your assessed property value').fill('800000');
  await expect(page.locator('#annual-tax')).toHaveText('$10,088');
  await page.getByLabel('Tax category').selectOption('precinct');
  await expect(page.locator('#annual-tax')).toHaveText('$10,584');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download this breakdown/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('hampton-tax-illustration-2025.csv');
  await page.screenshot({ path: 'artifacts/browser/desktop-taxes.png', fullPage: true });
  await page.getByLabel('Your assessed property value').fill('-1');
  await expect(page.locator('#tax-error')).toContainText('between');
  await expect(page.locator('#download-tax')).toBeDisabled();
});
test('spending switches years and preserves source context', async ({ page }) => {
  await page.goto('/#spending');
  await expect(page.locator('#operating-total')).toHaveText('$34,681,093');
  await expect(page.locator('#budget-percent')).toHaveText('94.09%');
  await page.getByLabel('Reporting year').selectOption('2024');
  await expect(page.locator('#operating-total')).toHaveText('$33,772,808');
  await page.getByRole('button', { name: 'Read the source ↗' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#dialog-title')).toHaveText('2024 town finance report');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('record search reaches actual meeting text and handles empty results', async ({ page }) => {
  await page.goto('/#records');
  await page.locator('#record-search').fill('September');
  await page.getByLabel('Filter records').selectOption('Meetings');
  await expect(page.locator('.record-row').first()).toBeVisible();
  await page.locator('.record-row button').first().click();
  await expect(page.locator('#dialog-text')).not.toBeEmpty();
  await page.screenshot({ path: 'artifacts/browser/desktop-record.png', fullPage: true });
  await page.getByRole('button', { name: 'Close record' }).click();
  await page.locator('#record-search').fill('zzzz-no-such-record-zzzz');
  await expect(page.getByRole('heading', { name: 'No matching records yet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  const recordCount = (await (await page.request.get('/data/records.json')).json()).records.length;
  await expect(page.locator('.record-row')).toHaveCount(recordCount);
});
test('mobile routes do not overflow and remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['overview', 'taxes', 'spending', 'records', 'about']) {
    await page.goto('/#' + route);
    await expect(page.locator('#' + route)).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: 'artifacts/browser/mobile-' + route + '.png', fullPage: true });
  }
  await page.goto('/#taxes');
  await page.getByLabel('Tax category').selectOption('partial');
  await expect(page.locator('#annual-tax')).toHaveText('$7,602');
});
test('keyboard navigation and draft request work', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('/');
  await expect(page.locator('#record-search')).toBeFocused();
  await page.goto('/#about');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download a draft records request ↓' }).click();
  expect((await pending).suggestedFilename()).toContain('DRAFT');
});
