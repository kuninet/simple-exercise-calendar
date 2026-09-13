import { test, expect } from '@playwright/test'

test('4種類のネコスタンプすべてが正常に画像として描画されること', async ({
  page
}) => {
  await page.goto('http://localhost:3000')

  // 設定ボタンをクリックしてモーダルを表示
  const settingsBtn = page.locator('.settings-button').first()
  await settingsBtn.click()

  // ユーザー管理モーダルのスタンプ選択エリアを確認
  const stampCards = page.locator('.cat-stamp-type-card')
  await expect(stampCards).toHaveCount(4)

  // 4つのスタンプ画像がすべて正常に読み込まれているか（100x100px）
  for (let i = 0; i < 4; i++) {
    const img = stampCards.nth(i).locator('img')
    await expect(img).toBeVisible()

    const isLoaded = await img.evaluate((el) => {
      return el.complete && el.naturalWidth > 0 && el.naturalHeight > 0
    })
    expect(isLoaded).toBe(true)
  }
})
