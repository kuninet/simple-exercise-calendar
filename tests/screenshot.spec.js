import { test } from '@playwright/test'

test('黒背景完全除去＆バッジ位置改善の視覚確認', async ({ page }) => {
  await page.goto('http://localhost:3000')

  // 設定ボタンをクリックして「おちゃめクロネコ」に切り替え
  const settingsBtn = page.locator('.settings-button').first()
  await settingsBtn.click()
  await page.waitForSelector('.cat-stamp-type-grid')

  // 4番目のカード（おちゃめクロネコ）をクリック
  const blackCatCard = page.locator('.cat-stamp-type-card').nth(3)
  await blackCatCard.click()

  // 閉じるボタンをクリック
  const closeBtn = page.locator('.modal-footer button, .close-button').first()
  if (await closeBtn.isVisible()) {
    await closeBtn.click()
  }

  await page.screenshot({
    path: 'cat_stamps_badge_fix_test.png',
    fullPage: true
  })
})
