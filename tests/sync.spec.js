const { test, expect } = require('@playwright/test')

test.describe('Wi-Fi同期とローカルファーストストレージのテスト (Issue #3)', () => {
  test('1. GET /api/ping が正常に応答すること', async ({ request }) => {
    const res = await request.get('/api/ping')
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.status).toBe('ok')
    expect(data.timestamp).toBeDefined()
  })

  test('2. POST /api/sync が正常に同期処理を実行できること', async ({
    request
  }) => {
    const payload = {
      users: [
        {
          id: 1,
          username: 'user1',
          display_name: 'テストユーザー1',
          color_theme: 'blue',
          default_exercise_id: 5
        }
      ],
      exercises: [
        {
          id: 1,
          name: 'テスト腕立て',
          category: '筋トレ',
          unit: '回',
          icon: '💪',
          is_active: 1
        }
      ],
      records: [
        {
          id: 99999,
          user_id: 1,
          exercise_id: 1,
          record_date: '2026-09-13',
          is_quick_record: 0,
          notes: '同期テスト記録',
          created_at: '2026-09-13T10:00:00+09:00'
        }
      ],
      deletedRecordIds: []
    }

    const res = await request.post('/api/sync', { data: payload })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.timestamp).toBeDefined()

    // 同期した記録がGET /api/recordsで取得できること
    const recordsRes = await request.get('/api/records?userId=1')
    expect(recordsRes.ok()).toBeTruthy()
    const recordsData = await recordsRes.json()
    expect(recordsData.success).toBe(true)
    const synced = recordsData.records.find(
      (r) => r.record_date === '2026-09-13' && r.notes === '同期テスト記録'
    )
    expect(synced).toBeDefined()
    expect(synced.notes).toBe('同期テスト記録')
  })

  test('3. 画面上に同期バッジとJSONバックアップ保存/復元ボタンが表示されること', async ({
    page
  }) => {
    await page.goto('/')

    // ヘッダータイトルの確認
    await expect(page.locator('h1')).toHaveText('エクササイズカレンダー')

    // 同期ステータスバッジの確認
    const badge = page.locator('.sync-status-badge')
    await expect(badge).toBeVisible()
    await expect(badge).toContainText('同期完了')

    // 下部データ管理セクションの確認
    const dataManagementSection = page.locator('.data-management')
    await expect(dataManagementSection).toBeVisible()
    await expect(dataManagementSection.locator('.backup-button')).toBeVisible()
    await expect(dataManagementSection.locator('.restore-button')).toBeVisible()
  })

  test('4. 「今日やった！」でローカルに即時記録されカレンダーに反映されること', async ({
    page
  }) => {
    await page.goto('/')

    // 初期ユーザーが読み込まれるのを待つ
    await expect(page.locator('.user-name')).not.toHaveText('ユーザーを選択')

    // 「今日やった！」ボタンをクリック（複数ある場合は最初のエレメント）
    const todayBtn = page.locator('.today-button').first()
    await expect(todayBtn).toBeVisible()
    await todayBtn.click()

    // 今日の日付セルに「済」スタンプが表示されること
    const todayCell = page.locator('.calendar-day.today')
    await expect(todayCell.locator('.stamp-done')).toBeVisible()

    // localStorageに保存されていることを確認
    const recordsRaw = await page.evaluate(() =>
      localStorage.getItem('exercise_records')
    )
    expect(recordsRaw).toBeTruthy()
    const records = JSON.parse(recordsRaw)
    expect(records.length).toBeGreaterThan(0)
  })

  test('5. オフライン時でもローカルファーストで動作し、バッジがローカル動作中になること', async ({
    context,
    page
  }) => {
    await page.goto('/')
    await expect(page.locator('.sync-status-badge')).toBeVisible()

    // ネットワークをオフラインに切断
    await context.setOffline(true)
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))

    // バッジが「ローカル動作中」に変化することを確認
    const badge = page.locator('.sync-status-badge')
    await expect(badge).toContainText('ローカル動作中')

    // オンラインに復帰
    await context.setOffline(false)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))

    // バッジが「同期完了」に戻ること
    await expect(badge).toContainText('同期完了')
  })

  test('6. JSONバックアップ保存をクリックするとJSONファイルがダウンロードされること', async ({
    page
  }) => {
    await page.goto('/')

    // ダウンロードイベントを監視
    const downloadPromise = page.waitForEvent('download')
    await page.locator('.data-management .backup-button').click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/^exercise_backup_.*\.json$/)
  })

  test('7. JSONバックアップ復元でデータが正しく復元されること', async ({
    page
  }) => {
    await page.goto('/')

    const backupData = {
      version: 1,
      users: [
        {
          id: 1,
          username: 'user1',
          display_name: '復元テスト太郎',
          color_theme: 'green',
          default_exercise_id: 1
        }
      ],
      exercises: [
        {
          id: 1,
          name: '腕立て伏せ',
          category: '筋トレ',
          unit: '回',
          icon: '🤲',
          is_active: 1
        }
      ],
      records: [
        {
          id: 8888,
          user_id: 1,
          exercise_id: 1,
          record_date: '2026-09-01',
          is_quick_record: 1,
          notes: '復元データ'
        }
      ]
    }

    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.locator('.data-management .restore-button').click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles({
      name: 'restore_test.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backupData))
    })

    // ユーザー名が復元された名前に更新されること
    await expect(page.locator('.user-name')).toHaveText('復元テスト太郎')
  })
})
