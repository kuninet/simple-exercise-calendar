const { createApp, ref, computed, onMounted } = Vue

// ==========================================
// LocalStore: ローカルファーストストレージモジュール
// ==========================================
const LocalStore = {
  KEYS: {
    USERS: 'exercise_users',
    EXERCISES: 'exercise_exercises',
    RECORDS: 'exercise_records',
    DELETED_RECORDS: 'exercise_deleted_record_ids',
    LAST_SYNC: 'exercise_last_sync',
    INITIALIZED: 'exercise_initialized'
  },

  DEFAULT_USERS: [
    {
      id: 1,
      username: 'user1',
      display_name: 'ユーザー1',
      color_theme: 'blue',
      default_exercise_id: 5,
      cat_stamp_type: 'red_cat'
    },
    {
      id: 2,
      username: 'user2',
      display_name: 'ユーザー2',
      color_theme: 'green',
      default_exercise_id: 5,
      cat_stamp_type: 'pink_paw'
    },
    {
      id: 3,
      username: 'user3',
      display_name: 'ユーザー3',
      color_theme: 'purple',
      default_exercise_id: 5,
      cat_stamp_type: 'white_cat'
    }
  ],

  DEFAULT_EXERCISES: [
    {
      id: 1,
      name: '腹筋',
      category: '筋トレ',
      unit: '回',
      icon: '💪',
      is_active: 1
    },
    {
      id: 2,
      name: '腕立て伏せ',
      category: '筋トレ',
      unit: '回',
      icon: '🤲',
      is_active: 1
    },
    {
      id: 3,
      name: 'スクワット',
      category: '筋トレ',
      unit: '回',
      icon: '🦵',
      is_active: 1
    },
    {
      id: 4,
      name: 'プランク',
      category: '筋トレ',
      unit: '秒',
      icon: '⏱️',
      is_active: 1
    },
    {
      id: 5,
      name: 'ランニング',
      category: '有酸素',
      unit: '分',
      icon: '🏃',
      is_active: 1
    },
    {
      id: 6,
      name: 'ウォーキング',
      category: '有酸素',
      unit: '分',
      icon: '🚶',
      is_active: 1
    },
    {
      id: 7,
      name: 'ストレッチ',
      category: 'その他',
      unit: '分',
      icon: '🧘',
      is_active: 1
    },
    {
      id: 8,
      name: 'ヨガ',
      category: 'その他',
      unit: '分',
      icon: '🧘‍♀️',
      is_active: 1
    }
  ],

  // 初期化：ローカルにデータが無ければ初期データを投入
  async init() {
    const initialized = localStorage.getItem(this.KEYS.INITIALIZED)
    if (initialized) {
      return
    }

    // 初回起動時：オンラインかつサーバー接続可能ならサーバーから引継ぎ
    if (navigator.onLine) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 800)
        const ping = await fetch('/api/ping', { signal: controller.signal })
        clearTimeout(timer)

        if (ping.ok) {
          const [usersRes, exRes, recRes] = await Promise.all([
            fetch('/api/users'),
            fetch('/api/exercises'),
            fetch('/api/records')
          ])

          if (usersRes.ok && exRes.ok && recRes.ok) {
            const uData = await usersRes.json()
            const eData = await exRes.json()
            const rData = await recRes.json()

            if (uData.users && uData.users.length > 0) {
              this.saveUsers(uData.users)
              this.saveExercises(
                eData.exercises && eData.exercises.length > 0
                  ? eData.exercises
                  : this.DEFAULT_EXERCISES
              )
              this.saveRecords(rData.records || [])
              localStorage.setItem(this.KEYS.INITIALIZED, 'true')
              localStorage.setItem(
                this.KEYS.LAST_SYNC,
                formatCurrentJSTTimestamp()
              )
              return
            }
          }
        }
      } catch (e) {
        console.log(
          '初回サーバーデータ引継ぎをスキップ（ローカル初期データを使用）:',
          e.message
        )
      }
    }

    // デフォルト値で初期化
    if (!localStorage.getItem(this.KEYS.USERS)) {
      this.saveUsers(this.DEFAULT_USERS)
    }
    if (!localStorage.getItem(this.KEYS.EXERCISES)) {
      this.saveExercises(this.DEFAULT_EXERCISES)
    }
    if (!localStorage.getItem(this.KEYS.RECORDS)) {
      this.saveRecords([])
    }
    localStorage.setItem(this.KEYS.INITIALIZED, 'true')
  },

  // ユーザー操作
  getUsers() {
    try {
      const raw = localStorage.getItem(this.KEYS.USERS)
      return raw ? JSON.parse(raw) : [...this.DEFAULT_USERS]
    } catch {
      return [...this.DEFAULT_USERS]
    }
  },

  saveUsers(users) {
    localStorage.setItem(this.KEYS.USERS, JSON.stringify(users))
  },

  addUser({ displayName, colorTheme = 'blue', catStampType = 'red_cat' }) {
    const users = this.getUsers()
    const nextId =
      users.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0) + 1
    const newUser = {
      id: nextId,
      username: `user_${nextId}_${Date.now()}`,
      display_name: displayName,
      color_theme: colorTheme,
      default_exercise_id: 5,
      cat_stamp_type: catStampType
    }
    users.push(newUser)
    this.saveUsers(users)
    return newUser
  },

  updateUserName(userId, displayName) {
    const users = this.getUsers()
    const user = users.find((u) => u.id === userId)
    if (user) {
      user.display_name = displayName
      this.saveUsers(users)
    }
    return user
  },

  updateUserCatStamp(userId, catStampType) {
    const users = this.getUsers()
    const user = users.find((u) => u.id === userId)
    if (user) {
      user.cat_stamp_type = catStampType
      this.saveUsers(users)
    }
    return user
  },

  updateDefaultExercise(userId, exerciseId) {
    const users = this.getUsers()
    const user = users.find((u) => u.id === userId)
    if (user) {
      user.default_exercise_id = exerciseId
      this.saveUsers(users)
    }
    return user
  },

  // エクササイズ操作
  getExercises() {
    try {
      const raw = localStorage.getItem(this.KEYS.EXERCISES)
      return raw ? JSON.parse(raw) : [...this.DEFAULT_EXERCISES]
    } catch {
      return [...this.DEFAULT_EXERCISES]
    }
  },

  saveExercises(exercises) {
    localStorage.setItem(this.KEYS.EXERCISES, JSON.stringify(exercises))
  },

  // 記録操作
  getAllRecords() {
    try {
      const raw = localStorage.getItem(this.KEYS.RECORDS)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  },

  getRecords(userId) {
    const records = this.getAllRecords()
    const exercises = this.getExercises()
    const exMap = new Map(exercises.map((e) => [e.id, e]))

    const filtered = userId
      ? records.filter((r) => r.user_id === userId)
      : records
    return filtered
      .map((r) => {
        const ex = exMap.get(r.exercise_id) || {}
        return {
          ...r,
          exercise_name: ex.name || 'エクササイズ',
          exercise_category: ex.category || '',
          exercise_icon: ex.icon || '🏃'
        }
      })
      .sort((a, b) => b.record_date.localeCompare(a.record_date) || b.id - a.id)
  },

  saveRecords(records) {
    localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(records))
  },

  addRecord({ userId, exerciseId, date, isQuickRecord = false, notes = '' }) {
    const records = this.getAllRecords()
    const existing = records.find(
      (r) =>
        r.user_id === userId &&
        r.exercise_id === exerciseId &&
        r.record_date === date
    )
    if (existing) {
      return { record: existing, isDuplicate: true }
    }

    const nextId =
      records.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1
    const newRecord = {
      id: nextId,
      user_id: userId,
      exercise_id: exerciseId,
      record_date: date,
      is_quick_record: isQuickRecord ? 1 : 0,
      notes: notes || '',
      created_at: formatCurrentJSTTimestamp()
    }
    records.push(newRecord)
    this.saveRecords(records)
    return { record: newRecord, isDuplicate: false }
  },

  removeRecord(recordId) {
    let records = this.getAllRecords()
    records = records.filter((r) => r.id !== recordId)
    this.saveRecords(records)
    this.trackDeletedRecordId(recordId)
  },

  removeRecordsForDate(userId, date) {
    let records = this.getAllRecords()
    const toDelete = records.filter(
      (r) => r.user_id === userId && r.record_date === date
    )
    records = records.filter(
      (r) => !(r.user_id === userId && r.record_date === date)
    )
    this.saveRecords(records)
    toDelete.forEach((r) => this.trackDeletedRecordId(r.id))
    return toDelete.length
  },

  trackDeletedRecordId(recordId) {
    try {
      const raw = localStorage.getItem(this.KEYS.DELETED_RECORDS)
      const list = raw ? JSON.parse(raw) : []
      if (!list.includes(recordId)) {
        list.push(recordId)
        localStorage.setItem(this.KEYS.DELETED_RECORDS, JSON.stringify(list))
      }
    } catch {
      localStorage.setItem(
        this.KEYS.DELETED_RECORDS,
        JSON.stringify([recordId])
      )
    }
  },

  getDeletedRecordIds() {
    try {
      const raw = localStorage.getItem(this.KEYS.DELETED_RECORDS)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  },

  clearDeletedRecordIds() {
    localStorage.removeItem(this.KEYS.DELETED_RECORDS)
  },

  // 全データ取得（エクスポート・同期用）
  getAllData() {
    return {
      version: 1,
      exportedAt: formatCurrentJSTTimestamp(),
      users: this.getUsers(),
      exercises: this.getExercises(),
      records: this.getAllRecords()
    }
  },

  // 全データ復元（インポート用）
  restoreAllData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('無効なデータ形式です')
    }

    if (Array.isArray(data.users) && data.users.length > 0) {
      this.saveUsers(data.users)
    }
    if (Array.isArray(data.exercises) && data.exercises.length > 0) {
      this.saveExercises(data.exercises)
    }
    if (Array.isArray(data.records)) {
      this.saveRecords(data.records)
    }
    this.clearDeletedRecordIds()
    localStorage.setItem(this.KEYS.INITIALIZED, 'true')
  }
}

// ==========================================
// JST日時ヘルパー関数
// ==========================================
function formatCurrentJSTTimestamp() {
  const now = new Date()
  const offset = 9 * 60 // JSTはUTC+9
  const jstDate = new Date(
    now.getTime() + (offset + now.getTimezoneOffset()) * 60000
  )
  const y = jstDate.getFullYear()
  const m = String(jstDate.getMonth() + 1).padStart(2, '0')
  const d = String(jstDate.getDate()).padStart(2, '0')
  const hh = String(jstDate.getHours()).padStart(2, '0')
  const mm = String(jstDate.getMinutes()).padStart(2, '0')
  const ss = String(jstDate.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}+09:00`
}

function getCurrentJSTDateString() {
  const now = new Date()
  const offset = 9 * 60
  const jstDate = new Date(
    now.getTime() + (offset + now.getTimezoneOffset()) * 60000
  )
  const y = jstDate.getFullYear()
  const m = String(jstDate.getMonth() + 1).padStart(2, '0')
  const d = String(jstDate.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ==========================================
// 統計・褒めメッセージ計算ヘルパー（完全オフライン対応）
// ==========================================
function calculateCurrentStreakForStats(records) {
  if (!records || records.length === 0) return 0
  const dates = [...new Set(records.map((r) => r.record_date))].sort().reverse()
  if (dates.length === 0) return 0

  const todayStr = getCurrentJSTDateString()
  const today = new Date(todayStr)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayYear = yesterday.getFullYear()
  const yesterdayMonth = String(yesterday.getMonth() + 1).padStart(2, '0')
  const yesterdayDay = String(yesterday.getDate()).padStart(2, '0')
  const yesterdayStr = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`

  const latestDate = dates[0]
  if (latestDate !== todayStr && latestDate !== yesterdayStr) {
    return 0
  }

  let streak = 0
  let checkDate = new Date(latestDate)

  for (const d of dates) {
    const y = checkDate.getFullYear()
    const m = String(checkDate.getMonth() + 1).padStart(2, '0')
    const day = String(checkDate.getDate()).padStart(2, '0')
    const expected = `${y}-${m}-${day}`
    if (d === expected) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}

function calculateLongestStreak(records) {
  if (!records || records.length === 0) return 0
  const dates = [...new Set(records.map((r) => r.record_date))].sort()
  if (dates.length === 0) return 0

  let longest = 1
  let current = 1

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1])
    const curr = new Date(dates[i])
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24))
    if (diffDays === 1) {
      current++
      longest = Math.max(longest, current)
    } else if (diffDays > 1) {
      current = 1
    }
  }

  return longest
}

function calculatePersonalStats(records) {
  const totalRecords = records.length
  const todayStr = getCurrentJSTDateString()
  const currentYearMonth = todayStr.substring(0, 7) // 'YYYY-MM'
  const thisMonthRecords = records.filter(
    (r) => r.record_date && r.record_date.startsWith(currentYearMonth)
  ).length

  return {
    totalRecords,
    currentStreak: calculateCurrentStreakForStats(records),
    longestStreak: calculateLongestStreak(records),
    thisMonthRecords
  }
}

function calculateFamilyStatsFromRecords(allRecords) {
  const totalFamilyRecords = allRecords.length
  const todayStr = getCurrentJSTDateString()
  const currentYearMonth = todayStr.substring(0, 7)

  const monthRecords = allRecords.filter(
    (r) => r.record_date && r.record_date.startsWith(currentYearMonth)
  )
  const activeFamilyMembers = new Set(monthRecords.map((r) => r.user_id)).size
  const familyRecordsToday = allRecords.filter(
    (r) => r.record_date === todayStr
  ).length

  return {
    totalFamilyRecords,
    activeFamilyMembers,
    familyRecordsToday
  }
}

function generatePraiseMessage(records) {
  const currentStreak = calculateCurrentStreakForStats(records)
  const totalRecords = records.length

  const streakMilestones = [
    {
      days: 100,
      message: '100日連続！🎊 伝説の領域！',
      type: 'legendary',
      animationType: 'celebration'
    },
    {
      days: 50,
      message: '50日連続！🏆 もはや達人！',
      type: 'master',
      animationType: 'fireworks'
    },
    {
      days: 30,
      message: '30日連続！🎯 完全に習慣化！',
      type: 'habit',
      animationType: 'rainbow'
    },
    {
      days: 21,
      message: '21日連続！🌟 習慣形成完了！',
      type: 'milestone',
      animationType: 'sparkle'
    },
    {
      days: 14,
      message: '14日連続！🔥 2週間達成！',
      type: 'milestone',
      animationType: 'fire'
    },
    {
      days: 10,
      message: '10日連続！⭐ 二桁達成！',
      type: 'milestone',
      animationType: 'star'
    },
    {
      days: 7,
      message: '7日連続！🎉 1週間達成！',
      type: 'milestone',
      animationType: 'confetti'
    }
  ]

  const totalMilestones = [
    {
      count: 365,
      message: '365回達成！🎊 1年分の記録！',
      type: 'legendary',
      animationType: 'celebration'
    },
    {
      count: 200,
      message: '200回達成！🏆 継続の王者！',
      type: 'master',
      animationType: 'fireworks'
    },
    {
      count: 100,
      message: '100回達成！🎯 三桁の壁突破！',
      type: 'milestone',
      animationType: 'rainbow'
    },
    {
      count: 50,
      message: '50回達成！🌟 半世紀達成！',
      type: 'milestone',
      animationType: 'sparkle'
    },
    {
      count: 30,
      message: '30回達成！⭐ 継続の力！',
      type: 'milestone',
      animationType: 'star'
    },
    {
      count: 10,
      message: '10回達成！🎉 二桁突入！',
      type: 'milestone',
      animationType: 'confetti'
    }
  ]

  for (const m of streakMilestones) {
    if (currentStreak === m.days) {
      return { ...m, isMilestone: true }
    }
  }

  for (const m of totalMilestones) {
    if (totalRecords === m.count) {
      return { ...m, isMilestone: true }
    }
  }

  if (currentStreak >= 30) {
    return {
      message: `${currentStreak}日連続！もはや習慣！🎉`,
      type: 'streak-long',
      animationType: 'pulse'
    }
  } else if (currentStreak >= 14) {
    return {
      message: `${currentStreak}日連続！すごすぎる！🔥`,
      type: 'streak-medium',
      animationType: 'pulse'
    }
  } else if (currentStreak >= 7) {
    return {
      message: `${currentStreak}日連続！1週間達成！⭐`,
      type: 'streak-week',
      animationType: 'bounce'
    }
  } else if (currentStreak >= 3) {
    return {
      message: `${currentStreak}日連続！調子いいね！💪`,
      type: 'streak-short',
      animationType: 'bounce'
    }
  } else if (currentStreak >= 2) {
    return {
      message: `${currentStreak}日連続！その調子！👍`,
      type: 'streak-start',
      animationType: 'bounce'
    }
  }

  const dailyMessages = [
    '今日やってえらい！',
    'すごい！',
    'その調子！',
    '素晴らしい！',
    'よくやった！',
    '継続は力なり！'
  ]
  return {
    message: dailyMessages[Math.floor(Math.random() * dailyMessages.length)],
    type: 'daily',
    animationType: 'bounce'
  }
}

createApp({
  setup() {
    // 状態管理
    const currentUser = ref(null)
    const users = ref([])
    const showUserSelector = ref(false)
    const currentDate = ref(new Date())
    const selectedExercise = ref(null)
    const exerciseRecords = ref([])
    const exercises = ref([])
    const showPraise = ref(false)
    const praiseMessage = ref('')
    const praiseClass = ref('praise-message')
    const praiseTimer = ref(null)

    // 同期・Wi-Fi接続状態管理
    const syncStatus = ref(navigator.onLine ? 'synced' : 'offline')
    const isSyncing = ref(false)
    const lastSyncTime = ref(
      localStorage.getItem(LocalStore.KEYS.LAST_SYNC) || ''
    )
    let syncDebounceTimer = null
    const fileInput = ref(null)

    const syncStatusText = computed(() => {
      if (syncStatus.value === 'syncing') return '同期中...'
      if (syncStatus.value === 'synced') return '同期完了'
      return 'ローカル動作中'
    })

    const syncStatusClass = computed(() => syncStatus.value)

    const syncStatusTooltip = computed(() => {
      if (syncStatus.value === 'synced') {
        return lastSyncTime.value
          ? `最終同期: ${formatTimeJST(lastSyncTime.value)}`
          : 'Wi-Fi同期完了'
      }
      if (syncStatus.value === 'syncing') {
        return 'サーバーと同期中...'
      }
      return 'オフラインまたはサーバー未接続のため、端末内のローカルデータで動作中'
    })

    // サーバーとの自動バックグラウンド同期
    const triggerSync = async () => {
      if (isSyncing.value) return
      if (!navigator.onLine) {
        syncStatus.value = 'offline'
        return
      }

      try {
        // 1. /api/ping でサーバー疎通確認（超高速800msタイムアウト）
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 800)
        const pingRes = await fetch('/api/ping', { signal: controller.signal })
        clearTimeout(timer)

        if (!pingRes.ok) {
          syncStatus.value = 'offline'
          return
        }

        const pingData = await pingRes.json()
        if (pingData.status !== 'ok') {
          syncStatus.value = 'offline'
          return
        }

        // 2. /api/sync に LocalStore データを送信
        isSyncing.value = true
        syncStatus.value = 'syncing'

        const payload = {
          users: LocalStore.getUsers(),
          exercises: LocalStore.getExercises(),
          records: LocalStore.getAllRecords(),
          deletedRecordIds: LocalStore.getDeletedRecordIds()
        }

        const syncRes = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        if (syncRes.ok) {
          const result = await syncRes.json()
          if (result.success) {
            LocalStore.clearDeletedRecordIds()
            const ts = result.timestamp || formatCurrentJSTTimestamp()
            lastSyncTime.value = ts
            localStorage.setItem(LocalStore.KEYS.LAST_SYNC, ts)
            syncStatus.value = 'synced'
            console.log('✅ バックグラウンド同期完了:', ts)
          } else {
            syncStatus.value = 'offline'
          }
        } else {
          syncStatus.value = 'offline'
        }
      } catch (error) {
        console.log(
          '同期スキップ（オフラインまたはサーバー未接続）:',
          error.message
        )
        syncStatus.value = 'offline'
      } finally {
        isSyncing.value = false
      }
    }

    // デバウンス付き同期リクエスト
    const requestSync = () => {
      if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer)
      }
      syncDebounceTimer = setTimeout(() => {
        triggerSync()
      }, 400)
    }

    // オンライン/オフラインイベント監視
    window.addEventListener('online', () => {
      console.log('🌐 オンラインに復帰しました。同期を開始します。')
      triggerSync()
    })

    window.addEventListener('offline', () => {
      console.log('🔌 オフラインになりました。ローカル動作に切り替えます。')
      syncStatus.value = 'offline'
    })

    // 定期同期間隔（30秒ごと）
    setInterval(() => {
      triggerSync()
    }, 30000)

    // トーストの同時表示上限（これを超えたら古いものから消す）
    const MAX_TOASTS = 3

    // トースト表示の共通処理
    // 画面上部に小さく積み上げるだけで背面は覆わないため、表示中もカレンダー・ボタンを操作できる
    const getToastContainer = () => {
      let container = document.querySelector('.toast-container')
      if (!container) {
        container = document.createElement('div')
        container.className = 'toast-container'
        // 全画面オーバーレイをやめた分、支援技術には読み上げで伝える
        container.setAttribute('role', 'status')
        container.setAttribute('aria-live', 'polite')
        container.setAttribute('aria-atomic', 'true')
        document.body.appendChild(container)
      }
      return container
    }

    // トーストを閉じる（フェードアウト後に DOM から取り除く）
    const removeToast = (toast) => {
      if (toast.dataset.closing === 'true') return
      toast.dataset.closing = 'true'
      if (toast.dismissTimer) {
        clearTimeout(toast.dismissTimer)
        toast.dismissTimer = null
      }
      toast.classList.add('toast-hide')

      const removeFromDom = () => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast)
        }
      }
      // 子要素のトランジションで早期撤去されないよう、トースト自身のものだけ拾う
      toast.addEventListener('transitionend', (event) => {
        if (event.target === toast) {
          removeFromDom()
        }
      })
      // トランジションが走らない環境（reduced-motion 等）向けのフォールバック撤去
      setTimeout(removeFromDom, 600)
    }

    // トーストを1件表示する
    const showToast = ({
      message,
      icon = '',
      bodyClass = '',
      duration = 3000,
      closable = false
    }) => {
      const toast = document.createElement('div')
      toast.className = 'toast'

      const body = document.createElement('div')
      body.className = `toast-body ${bodyClass}`.trim()

      if (icon) {
        const iconElement = document.createElement('span')
        iconElement.className = 'toast-icon'
        iconElement.textContent = icon
        body.appendChild(iconElement)
      }

      // サーバー由来の文字列が入るため textContent で埋めてエスケープ漏れを防ぐ
      const textElement = document.createElement('span')
      textElement.className = 'toast-text'
      textElement.textContent = message
      body.appendChild(textElement)

      if (closable) {
        const closeButton = document.createElement('button')
        closeButton.className = 'toast-close'
        closeButton.type = 'button'
        closeButton.setAttribute('aria-label', '閉じる')
        closeButton.textContent = '×'
        body.appendChild(closeButton)
      }

      toast.appendChild(body)
      // トースト本体（閉じるボタン含む）のどこをタップしても即座に消す
      toast.addEventListener('click', () => removeToast(toast))

      const container = getToastContainer()
      container.appendChild(toast)
      // 連投で画面上部が埋まらないよう、古いものから間引く
      const living = [...container.children].filter(
        (t) => t.dataset.closing !== 'true'
      )
      living
        .slice(0, Math.max(0, living.length - MAX_TOASTS))
        .forEach(removeToast)

      toast.dismissTimer = setTimeout(() => removeToast(toast), duration)
      return toast
    }

    // エラー表示機能
    const showError = (message, type = 'error') => {
      showToast({
        message,
        icon: type === 'warning' ? '⚠️' : '❌',
        bodyClass: `toast-${type === 'warning' ? 'warning' : 'error'}`,
        duration: 4000,
        closable: true
      })
    }

    // 成功メッセージ表示
    const showSuccess = (message) => {
      showToast({
        message,
        icon: '✅',
        bodyClass: 'toast-success',
        duration: 2000
      })
    }

    // カレンダー表示用の計算プロパティ（最適化版）
    const calendarDays = computed(() => {
      // 現在月のカレンダー日付を生成（メモ化で最適化）
      return generateCalendarDays(currentDate.value, exerciseRecords.value)
    })

    // 「今日やった」ボタンの処理（改良版）
    const recordToday = async () => {
      const todayStr = getCurrentJSTDateString()

      // 今日の記録があるかチェック
      const todayRecords = exerciseRecords.value.filter(
        (record) => record.record_date === todayStr
      )

      if (todayRecords.length > 0) {
        // 既に記録がある場合は、エクササイズ選択画面を表示
        showTodayExerciseSelector.value = true
        return
      }

      // 記録がない場合は記録処理を実行
      performTodayRecord(todayStr)
    }

    // 実際の記録処理（ローカル即時反映 + バックグラウンド同期）
    const performTodayRecord = (todayStr) => {
      if (!currentUser.value) return

      const defaultExId = currentUser.value.default_exercise_id || 5
      const { isDuplicate } = LocalStore.addRecord({
        userId: currentUser.value.id,
        exerciseId: defaultExId,
        date: todayStr,
        isQuickRecord: true
      })

      // ローカル即時再描画
      loadExerciseRecords()
      loadStats()
      loadFamilyStats()

      if (isDuplicate) {
        showPraiseAnimation('今日はもう記録済みです！', 'daily', 'bounce')
      } else {
        const userRecords = LocalStore.getRecords(currentUser.value.id)
        const praise = generatePraiseMessage(userRecords, todayStr)
        showPraiseAnimation(
          praise.message,
          praise.type || 'daily',
          praise.animationType || 'bounce',
          praise.isMilestone || false
        )
      }

      // バックグラウンド同期
      requestSync()
    }

    // 今日のエクササイズ追加（ローカル即時反映）
    const addTodayExercise = (exerciseId) => {
      if (!currentUser.value) return
      const todayStr = getCurrentJSTDateString()

      const { isDuplicate } = LocalStore.addRecord({
        userId: currentUser.value.id,
        exerciseId: exerciseId,
        date: todayStr,
        isQuickRecord: false
      })

      if (isDuplicate) {
        showError('このエクササイズは既に記録済みです')
        return
      }

      loadExerciseRecords()
      loadStats()
      loadFamilyStats()
      showTodayExerciseSelector.value = false
      showSuccess('エクササイズを追加しました')

      requestSync()
    }

    // 今日既に登録済みのエクササイズかどうかを判定
    const isTodayExerciseRegistered = (exerciseId) => {
      const todayStr = getCurrentJSTDateString()
      return exerciseRecords.value.some(
        (record) =>
          record.record_date === todayStr && record.exercise_id === exerciseId
      )
    }

    // 今日のエクササイズ選択をキャンセル
    const cancelTodayExerciseSelector = () => {
      showTodayExerciseSelector.value = false
    }

    // 日付のリセット確認を表示
    const showResetConfirmation = () => {
      if (
        !selectedDay.value ||
        !selectedDay.value.records ||
        selectedDay.value.records.length === 0
      ) {
        showError('削除する記録がありません')
        return
      }
      showResetConfirm.value = true
    }

    // リセット確認をキャンセル
    const cancelReset = () => {
      showResetConfirm.value = false
    }

    // 選択した日のすべてのエクササイズを削除（ローカル即時反映）
    const resetDayExercises = () => {
      const dayToReset = selectedDay.value

      if (
        !dayToReset ||
        !dayToReset.records ||
        dayToReset.records.length === 0
      ) {
        showError('削除する記録がありません')
        return
      }

      const targetDate = dayToReset.date
      const recordCount = dayToReset.records.length

      LocalStore.removeRecordsForDate(currentUser.value.id, targetDate)

      loadExerciseRecords()
      loadStats()
      loadFamilyStats()

      showResetConfirm.value = false
      closeDayDetails()
      showSuccess(`${recordCount}件のエクササイズ記録を削除しました`)

      requestSync()
    }

    // マイルストーン演出のキー操作（PC 向けの Esc クローズ）
    const handlePraiseKeydown = (event) => {
      if (event.key === 'Escape') {
        closePraise()
      }
    }

    // マイルストーン演出を閉じる（タイマーとキーリスナーを必ず後始末する）
    const closePraise = () => {
      if (praiseTimer.value) {
        clearTimeout(praiseTimer.value)
        praiseTimer.value = null
      }
      document.removeEventListener('keydown', handlePraiseKeydown)
      clearConfettiEffect()
      showPraise.value = false
    }

    // 褒めアニメーション表示
    const showPraiseAnimation = (
      message,
      type = 'daily',
      animationType = 'bounce',
      isMilestone = false
    ) => {
      // 通常の褒めは操作をブロックしないトーストで表示する（見た目のバリエーションはクラスで維持）
      if (!isMilestone) {
        showToast({
          message,
          bodyClass: `praise-message toast-praise ${type} ${animationType}`,
          duration: 3000
        })
        return
      }

      // マイルストーン時のみ従来どおり全画面演出 + 紙吹雪を出す
      // 前回のタイマー・キーリスナーが残らないよう、必ず閉じてから開き直す
      closePraise()
      praiseMessage.value = message
      // praiseType が 'milestone' の場合にクラスが重複しないよう Set でまとめる
      praiseClass.value = [
        ...new Set(['praise-message', type, animationType, 'milestone'])
      ].join(' ')
      showPraise.value = true
      createConfettiEffect()

      document.addEventListener('keydown', handlePraiseKeydown)
      praiseTimer.value = setTimeout(() => {
        closePraise()
      }, 5000)
    }

    // 紙吹雪の生成タイマーと表示中の紙片（早期クローズ時に止めるため保持する）
    const confettiTimers = []
    const confettiElements = []

    // 紙吹雪を止めて片付ける
    const clearConfettiEffect = () => {
      while (confettiTimers.length) {
        clearTimeout(confettiTimers.pop())
      }
      while (confettiElements.length) {
        const confetti = confettiElements.pop()
        if (confetti.parentNode) {
          confetti.parentNode.removeChild(confetti)
        }
      }
    }

    // 紙吹雪エフェクト
    const createConfettiEffect = () => {
      // シンプルな紙吹雪エフェクトを作成
      const colors = [
        '#FF6B6B',
        '#4ECDC4',
        '#45B7D1',
        '#96CEB4',
        '#FFEAA7',
        '#DDA0DD'
      ]

      for (let i = 0; i < 50; i++) {
        confettiTimers.push(
          setTimeout(() => {
            const confetti = document.createElement('div')
            confetti.className = 'confetti'
            confetti.style.cssText = `
            position: fixed;
            width: 10px;
            height: 10px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            left: ${Math.random() * 100}vw;
            top: -10px;
            z-index: 10000;
            border-radius: 50%;
            pointer-events: none;
            animation: confetti-fall 3s linear forwards;
          `
            document.body.appendChild(confetti)
            confettiElements.push(confetti)

            confettiTimers.push(
              setTimeout(() => {
                const index = confettiElements.indexOf(confetti)
                if (index !== -1) {
                  confettiElements.splice(index, 1)
                }
                if (confetti.parentNode) {
                  confetti.parentNode.removeChild(confetti)
                }
              }, 3000)
            )
          }, i * 50)
        )
      }
    }

    // ユーザー管理機能（ローカル即時読み込み）
    const loadUsers = () => {
      users.value = LocalStore.getUsers()

      // 初期ユーザーの自動設定および既存ユーザーの最新化
      if (currentUser.value) {
        const matching = users.value.find((u) => u.id === currentUser.value.id)
        currentUser.value =
          matching || (users.value.length > 0 ? users.value[0] : null)
      } else if (users.value.length > 0) {
        currentUser.value = users.value[0]
        loadUserData()
      }
    }

    const switchUser = (user) => {
      if (currentUser.value?.id === user.id) {
        showUserSelector.value = false
        return
      }

      currentUser.value = user
      showUserSelector.value = false
      loadUserData()
    }

    const loadUserData = () => {
      if (!currentUser.value) return
      loadExerciseRecords()
      loadStats()
      loadFamilyStats()
    }

    const toggleUserSelector = () => {
      showUserSelector.value = !showUserSelector.value
    }

    // カラーテーマの色を取得
    const getColorForTheme = (theme) => {
      const colors = {
        blue: '#2196F3',
        green: '#4CAF50',
        purple: '#9C27B0',
        orange: '#FF9800',
        red: '#F44336',
        teal: '#009688'
      }
      return colors[theme] || colors.blue
    }

    // データ読み込み（LocalStoreから即時取得）
    const loadExerciseRecords = () => {
      if (!currentUser.value) {
        exerciseRecords.value = []
        return
      }
      exerciseRecords.value = LocalStore.getRecords(currentUser.value.id)
    }

    const loadExercises = () => {
      exercises.value = LocalStore.getExercises()
      selectedExercise.value = null
    }

    // 月の変更
    const changeMonth = (direction) => {
      const newDate = new Date(currentDate.value)
      newDate.setMonth(newDate.getMonth() + direction)
      currentDate.value = newDate
    }

    // 統計情報を取得
    const stats = ref({
      totalRecords: 0,
      currentStreak: 0,
      longestStreak: 0,
      thisMonthRecords: 0
    })

    const familyStats = ref({
      totalFamilyRecords: 0,
      activeFamilyMembers: 0,
      familyRecordsToday: 0
    })

    const loadStats = () => {
      if (!currentUser.value) return
      const userRecords = LocalStore.getRecords(currentUser.value.id)
      stats.value = calculatePersonalStats(userRecords)
    }

    const loadFamilyStats = () => {
      const allRecords = LocalStore.getAllRecords()
      familyStats.value = calculateFamilyStatsFromRecords(allRecords)
    }

    // データ管理機能（JSONバックアップ保存・復元）
    const exportData = () => {
      try {
        const allData = LocalStore.getAllData()
        const jsonStr = JSON.stringify(allData, null, 2)
        const blob = new Blob([jsonStr], {
          type: 'application/json;charset=utf-8'
        })
        const today = getCurrentJSTDateString()
        const filename = `exercise_backup_${today}.json`

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        showSuccess(`JSONバックアップを保存しました (${filename})`)
      } catch (error) {
        console.error('バックアップ保存エラー:', error)
        showError(`バックアップ保存に失敗しました: ${error.message}`)
      }
    }

    const triggerImportFile = () => {
      if (fileInput.value) {
        fileInput.value.click()
      }
    }

    const onFileInputChange = (event) => {
      const file = event.target.files && event.target.files[0]
      if (file) {
        importData(file)
      }
      event.target.value = ''
    }

    const importData = (file) => {
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const content = e.target.result
          const parsed = JSON.parse(content)

          if (!parsed || typeof parsed !== 'object') {
            showError('バックアップファイルの形式が無効です')
            return
          }

          if (!parsed.users && !parsed.exercises && !parsed.records) {
            showError('エクササイズカレンダーのデータが見つかりません')
            return
          }

          LocalStore.restoreAllData(parsed)

          loadUsers()
          loadExercises()
          loadUserData()

          showSuccess('JSONバックアップからデータを復元しました')
          requestSync()
        } catch (err) {
          console.error('バックアップ復元エラー:', err)
          showError(`復元に失敗しました: ${err.message}`)
        }
      }
      reader.onerror = () => {
        showError('ファイルの読み込みに失敗しました')
      }
      reader.readAsText(file)
    }

    const createBackup = async () => {
      exportData()
    }

    // ネコスタンプ種類定義
    const catStampTypes = [
      {
        id: 'red_cat',
        name: '朱肉にゃんこ',
        icon: '🐱',
        file: 'cat_red.svg',
        desc: '王道の済ハンコ'
      },
      {
        id: 'pink_paw',
        name: 'ぷにぷに肉球',
        icon: '🐾',
        file: 'cat_pink.svg',
        desc: 'ピンクの足跡'
      },
      {
        id: 'white_cat',
        name: 'ニッコリしろねこ',
        icon: '😺',
        file: 'cat_white.svg',
        desc: '笑顔のしろねこ'
      },
      {
        id: 'black_cat',
        name: 'おちゃめクロネコ',
        icon: '🐈‍⬛',
        file: 'cat_black.svg',
        desc: '黒猫アイコン'
      }
    ]

    const getCatStampFile = (type) => {
      const found = catStampTypes.find((st) => st.id === type)
      return found ? found.file : 'cat_red.svg'
    }

    // ユーザー管理用の状態
    const showUserManagement = ref(false)
    const showAddUser = ref(false)
    const showEditUser = ref(false)
    const newUserName = ref('')
    const newUserColor = ref('blue')
    const newUserCatStamp = ref('red_cat')
    const editUserName = ref('')
    const editUserCatStamp = ref('red_cat')

    // ユーザー管理機能
    const toggleUserManagement = () => {
      showUserManagement.value = !showUserManagement.value
      showAddUser.value = false
      showEditUser.value = false
    }

    const toggleAddUser = () => {
      showAddUser.value = !showAddUser.value
      newUserName.value = ''
      newUserColor.value = 'blue'
      newUserCatStamp.value = 'red_cat'
    }

    const toggleEditUser = () => {
      showEditUser.value = !showEditUser.value
      editUserName.value = currentUser.value?.display_name || ''
      editUserCatStamp.value = currentUser.value?.cat_stamp_type || 'red_cat'
    }

    // ユーザー追加（ローカル即時反映）
    const addUser = () => {
      if (!newUserName.value.trim()) {
        showError('ユーザー名を入力してください')
        return
      }

      LocalStore.addUser({
        displayName: newUserName.value.trim(),
        colorTheme: newUserColor.value,
        catStampType: newUserCatStamp.value
      })

      loadUsers()
      showAddUser.value = false
      newUserName.value = ''
      showSuccess('ユーザーを追加しました')

      requestSync()
    }

    // ネコスタンプの種類変更
    const updateUserStamp = (stampType) => {
      if (!currentUser.value) return
      const updated = LocalStore.updateUserCatStamp(
        currentUser.value.id,
        stampType
      )
      if (updated) {
        currentUser.value.cat_stamp_type = stampType
        editUserCatStamp.value = stampType
        loadUsers()
        showSuccess('ネコスタンプの種類を変更しました！')

        requestSync()
      }
    }

    // ユーザー名更新（ローカル即時反映）
    const updateUserName = () => {
      if (!editUserName.value.trim() || !currentUser.value) {
        showError('ユーザー名を入力してください')
        return
      }

      const updated = LocalStore.updateUserName(
        currentUser.value.id,
        editUserName.value.trim()
      )
      if (updated) {
        currentUser.value.display_name = updated.display_name
        loadUsers()
        showEditUser.value = false
        showSuccess('ユーザー名を更新しました')

        requestSync()
      }
    }
    // デフォルトエクササイズ設定用の状態
    const showDefaultExerciseSettings = ref(false)

    // デフォルトエクササイズ更新（ローカル即時反映）
    const updateDefaultExercise = (exerciseId) => {
      if (!currentUser.value) return

      const updated = LocalStore.updateDefaultExercise(
        currentUser.value.id,
        exerciseId
      )
      if (updated) {
        currentUser.value.default_exercise_id = exerciseId
        showDefaultExerciseSettings.value = false
        showSuccess('デフォルトエクササイズを更新しました')

        requestSync()
      }
    }

    // デフォルトエクササイズ設定の切り替え
    const toggleDefaultExerciseSettings = () => {
      showDefaultExerciseSettings.value = !showDefaultExerciseSettings.value
    }
    // エクササイズの追加・削除機能（ローカル即時反映）
    const addExerciseToDay = (date, exerciseId) => {
      if (!currentUser.value) return

      const { isDuplicate } = LocalStore.addRecord({
        userId: currentUser.value.id,
        exerciseId: exerciseId,
        date: date,
        isQuickRecord: false
      })

      if (isDuplicate) {
        showError('このエクササイズは既に記録済みです')
        return
      }

      loadExerciseRecords()
      loadStats()
      loadFamilyStats()

      const updatedDay = calendarDays.value.find((day) => day.date === date)
      if (updatedDay) {
        selectedDay.value = updatedDay
      }
      showSuccess('エクササイズを追加しました')

      requestSync()
    }

    const removeExerciseFromDay = (recordId) => {
      LocalStore.removeRecord(recordId)

      loadExerciseRecords()
      loadStats()
      loadFamilyStats()

      if (selectedDay.value) {
        const updatedDay = calendarDays.value.find(
          (day) => day.date === selectedDay.value.date
        )
        if (updatedDay) {
          selectedDay.value = updatedDay
        }
      }
      showSuccess('エクササイズを削除しました')

      requestSync()
    }
    // 日付詳細表示用の状態
    const showDayDetails = ref(false)
    const selectedDay = ref(null)
    const showAddExercise = ref(false)

    // 「今日やった」ボタン用の状態
    const showTodayExerciseSelector = ref(false)

    // リセット確認用の状態
    const showResetConfirm = ref(false)

    // 日付クリック処理
    const onDayClick = (day) => {
      if (day.status === 'other-month') {
        return // 他月の日付はクリック無効
      }

      selectedDay.value = day
      showDayDetails.value = true
      showAddExercise.value = false
    }

    // 日付詳細を閉じる
    const closeDayDetails = () => {
      showDayDetails.value = false
      selectedDay.value = null
      showAddExercise.value = false
    }

    // エクササイズ追加モードの切り替え
    const toggleAddExercise = () => {
      console.log(
        'toggleAddExercise called, current state:',
        showAddExercise.value
      )
      showAddExercise.value = !showAddExercise.value
      console.log('toggleAddExercise new state:', showAddExercise.value)
    }
    // JST時刻フォーマット関数（改良版）
    const formatTimeJST = (timeString) => {
      if (!timeString) return ''

      try {
        // JST形式のタイムスタンプ（例: 2024-12-24T15:30:45+09:00）を処理
        let date

        if (timeString.includes('+09:00')) {
          // 既にJST形式の場合はそのまま使用
          date = new Date(timeString)
        } else {
          // 古い形式やUTC形式の場合は変換
          date = new Date(timeString)
        }

        if (isNaN(date.getTime())) {
          console.warn('無効な日付形式:', timeString)
          return '時刻不明'
        }

        // 日本時間で時刻を表示
        return date.toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Tokyo'
        })
      } catch (error) {
        console.error('時刻フォーマットエラー:', error, timeString)
        return '時刻不明'
      }
    }

    // 日付フォーマット関数（JST改良版）
    const formatDateJST = (timeString) => {
      if (!timeString) return ''

      try {
        // JST形式のタイムスタンプ（例: 2024-12-24T15:30:45+09:00）を処理
        let date

        if (timeString.includes('+09:00')) {
          // 既にJST形式の場合はそのまま使用
          date = new Date(timeString)
        } else {
          // 古い形式やUTC形式の場合は変換
          date = new Date(timeString)
        }

        if (isNaN(date.getTime())) {
          console.warn('無効な日付形式:', timeString)
          return '日付不明'
        }

        return date.toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'Asia/Tokyo'
        })
      } catch (error) {
        console.error('日付フォーマットエラー:', error, timeString)
        return '日付不明'
      }
    }

    // 日付のツールチップテキストを生成
    const getdayTooltip = (day) => {
      if (day.status === 'other-month') return ''

      const date = new Date(day.date)
      const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`

      if (day.recordCount === 0) {
        return `${dateStr}: 記録なし (クリックで記録追加)`
      } else if (day.recordCount === 1) {
        const exerciseName = day.records[0]?.exercise_name || 'エクササイズ'
        return `${dateStr}: ${exerciseName}を実施 (クリックで編集)`
      } else {
        return `${dateStr}: ${day.recordCount}種類のエクササイズを実施 (クリックで編集)`
      }
    }

    // PWAインストール促進
    const showInstallPrompt = ref(false)
    let deferredPrompt = null

    // PWAインストール可能イベント
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      deferredPrompt = e
      showInstallPrompt.value = true
    })

    // PWAインストール実行
    const installPWA = async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        console.log(`PWAインストール結果: ${outcome}`)
        deferredPrompt = null
        showInstallPrompt.value = false
      }
    }

    // PWAインストール促進を閉じる
    const dismissInstallPrompt = () => {
      showInstallPrompt.value = false
      deferredPrompt = null
    }

    // 初期化
    onMounted(async () => {
      await LocalStore.init()
      loadUsers()
      loadExercises()
      triggerSync()
    })

    return {
      currentUser,
      users,
      showUserSelector,
      showUserManagement,
      showAddUser,
      showEditUser,
      newUserName,
      newUserColor,
      editUserName,
      currentDate,
      selectedExercise,
      exercises,
      calendarDays,
      showPraise,
      praiseMessage,
      praiseClass,
      closePraise,
      stats,
      familyStats,
      showDayDetails,
      selectedDay,
      showAddExercise,
      showDefaultExerciseSettings,
      showTodayExerciseSelector,
      showResetConfirm,
      showInstallPrompt,
      installPWA,
      dismissInstallPrompt,
      recordToday,
      addTodayExercise,
      isTodayExerciseRegistered,
      cancelTodayExerciseSelector,
      showResetConfirmation,
      cancelReset,
      resetDayExercises,
      changeMonth,
      getdayTooltip,
      formatTimeJST,
      formatDateJST,
      onDayClick,
      closeDayDetails,
      toggleAddExercise,
      toggleDefaultExerciseSettings,
      toggleUserManagement,
      toggleAddUser,
      toggleEditUser,
      addUser,
      updateUserName,
      updateDefaultExercise,
      addExerciseToDay,
      removeExerciseFromDay,
      loadStats,
      switchUser,
      toggleUserSelector,
      getColorForTheme,
      createBackup,
      exportData,
      importData,
      triggerImportFile,
      onFileInputChange,
      fileInput,
      catStampTypes,
      getCatStampFile,
      newUserCatStamp,
      editUserCatStamp,
      updateUserStamp,
      syncStatus,
      syncStatusText,
      syncStatusClass,
      syncStatusTooltip,
      triggerSync
    }
  },

  template: `
    <div class="app">
      <!-- ヘッダー -->
      <header class="header">
        <div class="header-top">
          <div class="header-title-group">
            <h1>エクササイズカレンダー</h1>
            <!-- 同期ステータスバッジ -->
            <div :class="['sync-status-badge', syncStatusClass]" :title="syncStatusTooltip">
              <span class="sync-status-dot"></span>
              <span class="sync-status-text">{{ syncStatusText }}</span>
            </div>
          </div>

          <div class="header-controls">
            <div class="user-section">
              <div class="user-info" @click="toggleUserSelector">
                <span class="user-icon">👤</span>
                <span class="user-name">{{ currentUser?.display_name || 'ユーザーを選択' }}</span>
                <span class="dropdown-arrow">{{ showUserSelector ? '▲' : '▼' }}</span>
              </div>
              
              <!-- ユーザー選択ドロップダウン -->
              <div v-if="showUserSelector" class="user-dropdown">
                <div 
                  v-for="user in users" 
                  :key="user.id"
                  :class="['user-option', { active: currentUser?.id === user.id }]"
                  @click="switchUser(user)"
                >
                  <span class="user-color" :style="{ backgroundColor: getColorForTheme(user.color_theme) }"></span>
                  <span>{{ user.display_name }}</span>
                  <span v-if="currentUser?.id === user.id" class="check-icon">✓</span>
                </div>
                <div class="user-management-section">
                  <button class="user-management-button" @click="toggleUserManagement">
                    ⚙️ ユーザー管理
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- PWAインストール促進バナー -->
      <div v-if="showInstallPrompt" class="install-banner">
        <div class="install-content">
          <span class="install-icon">📱</span>
          <div class="install-text">
            <strong>アプリとしてインストール</strong>
            <p>ホーム画面に追加してアプリのように使えます</p>
          </div>
          <div class="install-actions">
            <button class="install-button" @click="installPWA">インストール</button>
            <button class="dismiss-button" @click="dismissInstallPrompt">×</button>
          </div>
        </div>
      </div>

      <!-- 簡単記録セクション（カレンダーの上に移動） -->
      <div class="quick-record-section">
        <div class="quick-record-header">
          <h3 class="quick-record-title">🏃‍♂️ 今日の運動記録</h3>
          <div class="quick-record-controls">
            <span class="default-exercise-display">
              {{ exercises.find(e => e.id === currentUser?.default_exercise_id)?.icon || '🏃' }} 
              {{ exercises.find(e => e.id === currentUser?.default_exercise_id)?.name || 'ランニング' }}
            </span>
            <button class="settings-button" @click="toggleDefaultExerciseSettings" title="デフォルトエクササイズを変更">
              ⚙️
            </button>
          </div>
        </div>
        <button 
          class="today-button"
          @click="recordToday"
        >
          今日やった！
        </button>
        
        <!-- デフォルトエクササイズ ＆ ネコスタンプ設定 -->
        <div v-if="showDefaultExerciseSettings" class="default-exercise-settings">
          <h4>🐾 お気に入りネコスタンプを選択</h4>
          <div class="cat-stamp-type-grid" style="margin-bottom: 20px;">
            <button 
              v-for="st in catStampTypes" 
              :key="st.id"
              :class="['cat-stamp-type-card', { active: (currentUser?.cat_stamp_type || 'red_cat') === st.id }]"
              @click="updateUserStamp(st.id)"
            >
              <img :src="'/stamps/' + st.file" class="cat-stamp-thumb-img" alt="スタンプ" />
              <span class="cat-stamp-name">{{ st.name }}</span>
            </button>
          </div>

          <h4>デフォルト運動を選択</h4>
          <div class="exercise-grid">
            <button 
              v-for="exercise in exercises" 
              :key="exercise.id"
              :class="['exercise-option', { 'selected': exercise.id === currentUser?.default_exercise_id }]"
              @click="updateDefaultExercise(exercise.id)"
            >
              <span class="exercise-icon">{{ exercise.icon || '🏃' }}</span>
              <span class="exercise-name">{{ exercise.name }}</span>
            </button>
          </div>
          <button class="cancel-settings-button" @click="toggleDefaultExerciseSettings">
            閉じる
          </button>
        </div>
      </div>

      <!-- メインコンテンツ -->
      <main class="main">
        <!-- カレンダー表示 -->
        <div class="calendar">
          <div class="calendar-header">
            <button @click="changeMonth(-1)" class="month-nav">‹</button>
            <h2>{{ currentDate.getFullYear() }}年{{ currentDate.getMonth() + 1 }}月</h2>
            <button @click="changeMonth(1)" class="month-nav">›</button>
          </div>
          <div class="calendar-weekdays">
            <div class="weekday">日</div>
            <div class="weekday">月</div>
            <div class="weekday">火</div>
            <div class="weekday">水</div>
            <div class="weekday">木</div>
            <div class="weekday">金</div>
            <div class="weekday">土</div>
          </div>
          <div class="calendar-grid">
            <div 
              v-for="day in calendarDays" 
              :key="day.date"
              :class="[
                'calendar-day', 
                day.status, 
                { 
                  'today': day.isToday,
                  'streak-day': day.isStreakDay && day.status === 'completed',
                  'clickable': day.status !== 'other-month'
                }
              ]"
              :title="getdayTooltip(day)"
              @click="onDayClick(day)"
            >
              <span class="day-number">{{ day.dayNumber }}</span>
              <div class="day-indicators">
                <!-- 可愛いネコ済スタンプ -->
                <div v-if="day.status === 'completed' || day.status === 'multiple-completed'" 
                     :class="[
                       'stamp-done',
                       'stamp-type-' + (currentUser?.cat_stamp_type || 'red_cat'),
                       { 
                         'stamp-large': day.recordCount === 2,
                         'stamp-xlarge': day.recordCount >= 3
                       }
                     ]"
                     :title="day.recordCount >= 3 ? '大変よくできましたニャ！🐾' : (day.recordCount === 2 ? 'よくできましたニャ！🐾' : 'できたニャ！🐾')">
                  <img :src="'/stamps/' + getCatStampFile(currentUser?.cat_stamp_type)" class="cat-stamp-img" alt="ネコスタンプ" />
                  <span v-if="day.recordCount >= 2" class="cat-paw-badge" aria-hidden="true">🐾</span>
                </div>
                <span v-if="day.recordCount > 1" class="record-count">{{ day.recordCount }}</span>
                <span v-if="day.isStreakDay && day.status === 'completed'" class="streak-indicator">🔥</span>
              </div>
            </div>
          </div>
        </div>

          <!-- エクササイズ選択と記録 -->
          <div class="exercise-section">
            <!-- 統計表示 -->
            <div class="stats-display">
              <div class="stat-item personal">
                <span class="stat-number">{{ stats.currentStreak }}</span>
                <span class="stat-label">連続記録</span>
              </div>
              <div class="stat-item personal">
                <span class="stat-number">{{ stats.totalRecords }}</span>
                <span class="stat-label">総記録数</span>
              </div>
              <div class="stat-item personal">
                <span class="stat-number">{{ stats.thisMonthRecords }}</span>
                <span class="stat-label">今月の記録</span>
              </div>
              <div class="stat-item personal">
                <span class="stat-number">{{ stats.longestStreak }}</span>
                <span class="stat-label">最長連続</span>
              </div>
            </div>

            <!-- 家族統計表示 -->
            <div class="family-stats-display">
              <h3 class="family-stats-title">👨‍👩‍👧‍👦 家族の記録</h3>
              <div class="family-stats-grid">
                <div class="stat-item family">
                  <span class="stat-number">{{ familyStats.totalFamilyRecords }}</span>
                  <span class="stat-label">家族総記録</span>
                </div>
                <div class="stat-item family">
                  <span class="stat-number">{{ familyStats.activeFamilyMembers }}</span>
                  <span class="stat-label">今月活動中</span>
                </div>
                <div class="stat-item family">
                  <span class="stat-number">{{ familyStats.familyRecordsToday }}</span>
                  <span class="stat-label">今日の家族記録</span>
                </div>
              </div>
            </div>

            <!-- 簡単記録セクション -->
            <div class="quick-record-section">
              <div class="quick-record-header">
                <h3 class="quick-record-title">🏃‍♂️ 今日の運動記録</h3>
                <button class="settings-button" @click="toggleDefaultExerciseSettings" :title="'デフォルト: ' + (exercises.find(e => e.id === currentUser?.default_exercise_id)?.name || 'ランニング')">
                  ⚙️
                </button>
              </div>
              <p class="quick-record-description">
                運動をした日を記録しましょう。詳細は後から追加できます。<br>
                <small>デフォルト: {{ exercises.find(e => e.id === currentUser?.default_exercise_id)?.icon || '🏃' }} {{ exercises.find(e => e.id === currentUser?.default_exercise_id)?.name || 'ランニング' }}</small>
              </p>
              <button 
                class="today-button"
                @click="recordToday"
              >
                今日やった！
              </button>
              
              <!-- デフォルトエクササイズ設定 -->
              <div v-if="showDefaultExerciseSettings" class="default-exercise-settings">
                <h4>デフォルトエクササイズを選択</h4>
                <div class="exercise-grid">
                  <button 
                    v-for="exercise in exercises" 
                    :key="exercise.id"
                    :class="['exercise-option', { 'selected': exercise.id === currentUser?.default_exercise_id }]"
                    @click="updateDefaultExercise(exercise.id)"
                  >
                    <span class="exercise-icon">{{ exercise.icon || '🏃' }}</span>
                    <span class="exercise-name">{{ exercise.name }}</span>
                  </button>
                </div>
          </div>

          <!-- データ管理セクション -->
          <div class="data-management">
            <h4 class="data-management-title">📊 データ管理（JSONバックアップ）</h4>
            <div class="data-management-buttons">
              <button class="backup-button" @click="exportData">
                💾 JSONバックアップ保存
              </button>
              <button class="restore-button" @click="triggerImportFile">
                📥 JSONバックアップ復元
              </button>
            </div>
            <!-- ファイル選択用インプット（非表示） -->
            <input type="file" ref="fileInput" accept=".json,application/json" style="display: none" @change="onFileInputChange">
          </div>
        </div>
      </main>

      <!-- 褒めアニメーション（マイルストーン時のみ全画面。背景・本体どこをタップしても閉じる） -->
      <div v-if="showPraise" class="praise-overlay" @click="closePraise">
        <div :class="praiseClass">
          {{ praiseMessage }}
        </div>
      </div>

      <!-- ユーザー管理モーダル -->
      <div v-if="showUserManagement" class="user-management-overlay" @click="toggleUserManagement">
        <div class="user-management-modal" @click.stop>
          <div class="user-management-header">
            <h3>ユーザー管理</h3>
            <button class="close-button" @click="toggleUserManagement">×</button>
          </div>
          <div class="user-management-content">
            <!-- 現在のユーザー設定（スタンプ切り替え含む） -->
            <div class="current-user-section">
              <h4>現在のユーザー: {{ currentUser?.display_name }}</h4>
              
              <!-- ネコスタンプ切り替え -->
              <div class="cat-stamp-selector-section">
                <h5>🐾 ネコスタンプのデザイン</h5>
                <div class="cat-stamp-type-grid">
                  <button 
                    v-for="st in catStampTypes" 
                    :key="st.id"
                    :class="['cat-stamp-type-card', { active: (currentUser?.cat_stamp_type || 'red_cat') === st.id }]"
                    @click="updateUserStamp(st.id)"
                  >
                    <img :src="'/stamps/' + st.file" class="cat-stamp-thumb-img" alt="スタンプ" />
                    <span class="cat-stamp-name">{{ st.name }}</span>
                  </button>
                </div>
              </div>

              <div v-if="!showEditUser" class="user-actions">
                <button class="edit-user-button" @click="toggleEditUser">
                  ✏️ 名前を変更
                </button>
              </div>
              <div v-if="showEditUser" class="edit-user-form">
                <input 
                  v-model="editUserName" 
                  type="text" 
                  placeholder="新しい名前"
                  class="user-name-input"
                  @keyup.enter="updateUserName"
                >
                <div class="form-buttons">
                  <button class="save-button" @click="updateUserName">保存</button>
                  <button class="cancel-button" @click="toggleEditUser">キャンセル</button>
                </div>
              </div>
            </div>
            
            <!-- ユーザー追加 -->
            <div class="add-user-section">
              <div v-if="!showAddUser" class="add-user-actions">
                <button class="add-user-button" @click="toggleAddUser">
                  ➕ 新しいユーザーを追加
                </button>
              </div>
              <div v-if="showAddUser" class="add-user-form">
                <input 
                  v-model="newUserName" 
                  type="text" 
                  placeholder="ユーザー名"
                  class="user-name-input"
                  @keyup.enter="addUser"
                >
                <select v-model="newUserColor" class="color-select">
                  <option value="blue">🔵 ブルー</option>
                  <option value="green">🟢 グリーン</option>
                  <option value="purple">🟣 パープル</option>
                  <option value="orange">🟠 オレンジ</option>
                  <option value="red">🔴 レッド</option>
                  <option value="teal">🟢 ティール</option>
                </select>

                <div class="cat-stamp-select-group">
                  <label>スタンプタイプ:</label>
                  <select v-model="newUserCatStamp" class="color-select">
                    <option v-for="st in catStampTypes" :key="st.id" :value="st.id">
                      {{ st.icon }} {{ st.name }}
                    </option>
                  </select>
                </div>

                <div class="form-buttons">
                  <button class="save-button" @click="addUser">追加</button>
                  <button class="cancel-button" @click="toggleAddUser">キャンセル</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 日付詳細モーダル -->
      <div v-if="showDayDetails && selectedDay" class="day-details-overlay" @click="closeDayDetails">
        <div class="day-details-modal" @click.stop>
          <div class="day-details-header">
            <h3>{{ new Date(selectedDay.date).getMonth() + 1 }}月{{ new Date(selectedDay.date).getDate() }}日の記録</h3>
            <div class="day-details-actions">
              <button v-if="selectedDay.recordCount > 0" class="reset-button" @click="showResetConfirmation" title="この日の記録をすべて削除">
                🗑️ リセット
              </button>
              <button class="close-button" @click="closeDayDetails">×</button>
            </div>
          </div>
          <div class="day-details-content">
            <div v-if="selectedDay.recordCount === 0" class="no-records">
              <p>この日はまだ記録がありません</p>
              <button class="add-first-record-button" @click="toggleAddExercise">
                📝 運動記録を追加
              </button>
            </div>
            <div v-else>
              <div class="records-list">
                <div 
                  v-for="record in selectedDay.records" 
                  :key="record.id"
                  class="record-item"
                >
                  <div class="record-exercise">
                    <span class="exercise-icon">{{ record.exercise_icon || '🏃' }}</span>
                    <span class="exercise-name">{{ record.exercise_name }}</span>
                    <span class="exercise-category">({{ record.exercise_category }})</span>
                  </div>
                  <div class="record-actions">
                    <span class="record-time">
                      {{ formatTimeJST(record.created_at) }}
                    </span>
                    <button class="remove-button" @click="removeExerciseFromDay(record.id)">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
              <div class="add-exercise-section">
                <button class="add-exercise-button" @click.stop="toggleAddExercise">
                  ➕ エクササイズを追加
                </button>
              </div>
            </div>
            
            <!-- エクササイズ追加フォーム -->
            <div v-if="showAddExercise" class="add-exercise-form">
              <h4>エクササイズを追加</h4>
              <div class="exercise-grid">
                <button 
                  v-for="exercise in exercises" 
                  :key="exercise.id"
                  class="exercise-option"
                  @click="addExerciseToDay(selectedDay.date, exercise.id)"
                >
                  <span class="exercise-icon">{{ exercise.icon || '🏃' }}</span>
                  <span class="exercise-name">{{ exercise.name }}</span>
                </button>
              </div>
              <button class="cancel-add-button" @click="toggleAddExercise">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- リセット確認モーダル -->
      <div v-if="showResetConfirm" class="reset-confirm-overlay" @click="cancelReset">
        <div class="reset-confirm-modal" @click.stop>
          <div class="reset-confirm-header">
            <h3>⚠️ 記録をリセットしますか？</h3>
          </div>
          <div class="reset-confirm-content">
            <p>この日のすべてのエクササイズ記録（{{ selectedDay?.recordCount || 0 }}件）を削除します。</p>
            <p><strong>この操作は取り消せません。</strong></p>
            <div class="reset-confirm-actions">
              <button class="reset-confirm-button" @click="resetDayExercises">
                削除する
              </button>
              <button class="reset-cancel-button" @click="cancelReset">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 今日のエクササイズ選択モーダル -->
      <div v-if="showTodayExerciseSelector" class="today-exercise-overlay" @click="cancelTodayExerciseSelector">
        <div class="today-exercise-modal" @click.stop>
          <div class="today-exercise-header">
            <h3>今日はどのエクササイズをしましたか？</h3>
            <button class="close-button" @click="cancelTodayExerciseSelector">×</button>
          </div>
          <div class="today-exercise-content">
            <p class="today-exercise-description">
              今日は既に記録があります。追加するエクササイズを選択してください。
            </p>
            <div class="exercise-grid">
              <button 
                v-for="exercise in exercises" 
                :key="exercise.id"
                :class="[
                  'exercise-option',
                  { 'exercise-registered': isTodayExerciseRegistered(exercise.id) }
                ]"
                @click="addTodayExercise(exercise.id)"
                :disabled="isTodayExerciseRegistered(exercise.id)"
              >
                <span class="exercise-icon">{{ exercise.icon || '🏃' }}</span>
                <span class="exercise-name">{{ exercise.name }}</span>
                <span v-if="isTodayExerciseRegistered(exercise.id)" class="registered-badge">登録済み</span>
              </button>
            </div>
            <div class="today-exercise-actions">
              <button class="cancel-button" @click="cancelTodayExerciseSelector">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}).mount('#app')

// ヘルパー関数
function generateCalendarDays(currentDate, exerciseRecords) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - firstDay.getDay()) // 週の始まりを日曜日に調整

  const days = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 記録のある日付をセットに変換（高速検索用）
  const recordDates = new Set(
    exerciseRecords.map((record) => record.record_date)
  )

  // 連続記録の計算
  const streakDays = calculateStreakDays(exerciseRecords)

  // 6週間分の日付を生成（42日）
  for (let i = 0; i < 42; i++) {
    const dayDate = new Date(startDate)
    dayDate.setDate(startDate.getDate() + i)

    // 日本時間での日付文字列を生成
    const dayYear = dayDate.getFullYear()
    const dayMonth = String(dayDate.getMonth() + 1).padStart(2, '0')
    const dayDay = String(dayDate.getDate()).padStart(2, '0')
    const dateString = `${dayYear}-${dayMonth}-${dayDay}`

    const isCurrentMonth = dayDate.getMonth() === month
    const isToday = dayDate.getTime() === today.getTime()

    // その日にエクササイズ記録があるかチェック
    const hasRecord = recordDates.has(dateString)
    const isStreakDay = streakDays.has(dateString)

    // その日の記録数を取得
    const dayRecords = exerciseRecords.filter(
      (record) => record.record_date === dateString
    )
    const recordCount = dayRecords.length

    let status = 'none'
    if (!isCurrentMonth) {
      status = 'other-month'
    } else if (hasRecord) {
      status = recordCount > 1 ? 'multiple-completed' : 'completed'
    }

    days.push({
      date: dateString,
      dayNumber: dayDate.getDate(),
      status: status,
      isToday: isToday,
      isCurrentMonth: isCurrentMonth,
      isStreakDay: isStreakDay,
      recordCount: recordCount,
      records: dayRecords
    })
  }

  return days
}

// 連続記録の日付を計算
function calculateStreakDays(exerciseRecords) {
  if (!exerciseRecords || exerciseRecords.length === 0) {
    return new Set()
  }

  // 記録のある日付を取得してソート
  const recordDates = [
    ...new Set(exerciseRecords.map((record) => record.record_date))
  ]
    .sort()
    .map((dateStr) => {
      // 日付文字列から直接Dateオブジェクトを作成（タイムゾーン問題を回避）
      const [year, month, day] = dateStr.split('-').map(Number)
      return new Date(year, month - 1, day)
    })

  const streakDays = new Set()
  let currentStreak = []

  for (let i = 0; i < recordDates.length; i++) {
    const currentDate = recordDates[i]
    const prevDate = recordDates[i - 1]

    if (i === 0 || isConsecutiveDay(prevDate, currentDate)) {
      // 連続している場合
      currentStreak.push(currentDate)
    } else {
      // 連続が途切れた場合
      if (currentStreak.length >= 2) {
        // 2日以上の連続記録をstreakDaysに追加
        currentStreak.forEach((date) => {
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          streakDays.add(`${year}-${month}-${day}`)
        })
      }
      currentStreak = [currentDate]
    }
  }

  // 最後の連続記録を処理
  if (currentStreak.length >= 2) {
    currentStreak.forEach((date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      streakDays.add(`${year}-${month}-${day}`)
    })
  }

  return streakDays
}

// 連続する日かどうかをチェック
function isConsecutiveDay(date1, date2) {
  const diffTime = Math.abs(date2 - date1)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays === 1
}
