const { test } = require('@playwright/test')

test('capture visual proof of black cat stamp without black border', async ({
  page
}) => {
  await page.goto('http://localhost:3000')

  // localStorage に直接黒猫スタンプを設定
  await page.evaluate(() => {
    const users = JSON.parse(localStorage.getItem('exercise_users') || '[]')
    if (users.length > 0) {
      users[0].cat_stamp_type = 'black_cat'
      localStorage.setItem('exercise_users', JSON.stringify(users))
    }
  })

  await page.reload()
  await page.waitForTimeout(500)

  // 今日のセルにスタンプを2回つける
  const todayCell = page.locator('.calendar-day.today')
  await todayCell.click()
  await page.waitForTimeout(200)
  await todayCell.click()
  await page.waitForTimeout(400)

  await page.screenshot({
    path: 'proof_black_cat_calendar.png',
    fullPage: true
  })
})
