const { createApp, ref, computed, onMounted } = Vue

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
    const showToast = ({ message, icon = '', bodyClass = '', duration = 3000, closable = false }) => {
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
      const living = [...container.children].filter(t => t.dataset.closing !== 'true')
      living.slice(0, Math.max(0, living.length - MAX_TOASTS)).forEach(removeToast)

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
      // 日本時間での今日の日付を取得
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      const todayStr = `${year}-${month}-${day}`
      
      // 今日の記録があるかチェック
      const todayRecords = exerciseRecords.value.filter(record => record.record_date === todayStr)
      
      if (todayRecords.length > 0) {
        // 既に記録がある場合は、エクササイズ選択画面を表示
        showTodayExerciseSelector.value = true
        return
      }
      
      // 記録がない場合は従来通りの処理
      await performTodayRecord(todayStr)
    }
    
    // 実際の記録処理
    const performTodayRecord = async (todayStr) => {
      // ボタンを一時的に無効化
      const button = document.querySelector('.today-button')
      const originalText = button.textContent
      button.disabled = true
      button.textContent = '記録中...'
      
      try {
        const response = await fetch('/api/record-day', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.value.id,
            date: todayStr
          })
        })
        
        const result = await response.json()
        
        if (!response.ok) {
          throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`)
        }
        
        if (!result.success) {
          // サーバー側のエラーコードに応じた処理
          if (result.code === 'DATABASE_BUSY') {
            showError('データベースが一時的に利用できません。しばらく待ってから再試行してください。', 'warning')
          } else if (result.code === 'FUTURE_DATE_NOT_ALLOWED') {
            showError('未来の日付は記録できません。', 'warning')
          } else {
            showError(result.error || '記録に失敗しました')
          }
          return
        }
        
        if (result.success) {
          // 記録成功時の処理
          await loadExerciseRecords()
          await loadStats() // 統計も更新
          await loadFamilyStats() // 家族統計も更新
          
          if (result.isDuplicate) {
            // 既に記録済みの場合
            showPraiseAnimation('今日はもう記録済みです！', 'daily', 'bounce')
          } else if (result.praise) {
            // 新規記録の場合
            showPraiseAnimation(
              result.praise, 
              result.praiseType || 'daily',
              result.animationType || 'bounce',
              result.isMilestone || false
            )
          }
        }
      } catch (error) {
        console.error('記録エラー:', error)
        if (error.message.includes('Failed to fetch')) {
          showError('ネットワーク接続を確認してください。')
        } else {
          showError(`記録に失敗しました: ${error.message}`)
        }
      } finally {
        // ボタンを元に戻す
        button.disabled = false
        button.textContent = originalText
      }
    }
    
    // 今日のエクササイズ追加
    const addTodayExercise = async (exerciseId) => {
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      const todayStr = `${year}-${month}-${day}`
      
      try {
        const response = await fetch('/api/add-exercise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.value.id,
            exerciseId: exerciseId,
            date: todayStr
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          await loadExerciseRecords()
          await loadStats()
          await loadFamilyStats()
          showTodayExerciseSelector.value = false
          showSuccess('エクササイズを追加しました')
        } else {
          showError(result.error || 'エクササイズの追加に失敗しました')
        }
      } catch (error) {
        console.error('エクササイズ追加エラー:', error)
        showError('エクササイズの追加に失敗しました')
      }
    }
    
    // 今日既に登録済みのエクササイズかどうかを判定
    const isTodayExerciseRegistered = (exerciseId) => {
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      const todayStr = `${year}-${month}-${day}`
      
      return exerciseRecords.value.some(record => 
        record.record_date === todayStr && record.exercise_id === exerciseId
      )
    }
    
    // 今日のエクササイズ選択をキャンセル
    const cancelTodayExerciseSelector = () => {
      showTodayExerciseSelector.value = false
    }
    
    // 日付のリセット確認を表示
    const showResetConfirmation = () => {
      if (!selectedDay.value || !selectedDay.value.records || selectedDay.value.records.length === 0) {
        showError('削除する記録がありません')
        return
      }
      showResetConfirm.value = true
    }
    
    // リセット確認をキャンセル
    const cancelReset = () => {
      showResetConfirm.value = false
    }
    
    // 選択した日のすべてのエクササイズを削除
    const resetDayExercises = async () => {
      // リセット確認モーダルが表示された時点でのselectedDayの情報を保存
      const dayToReset = selectedDay.value
      
      if (!dayToReset || !dayToReset.records || dayToReset.records.length === 0) {
        console.error('削除対象の日付データが見つかりません:', dayToReset)
        showError('削除する記録がありません')
        return
      }
      
      const targetDate = dayToReset.date
      const recordCount = dayToReset.records.length
      const recordIds = dayToReset.records.map(record => record.id)
      
      console.log('=== リセット処理開始 ===')
      console.log('対象日:', targetDate)
      console.log('削除対象記録数:', recordCount)
      console.log('削除対象ID:', recordIds)
      
      try {
        // 各記録を削除
        for (let i = 0; i < recordIds.length; i++) {
          const recordId = recordIds[i]
          console.log(`削除処理 ${i + 1}/${recordIds.length}: 記録ID ${recordId}`)
          
          const response = await fetch('/api/remove-exercise', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recordId: recordId })
          })
          
          if (!response.ok) {
            const errorText = await response.text()
            console.error(`HTTP エラー: ${response.status}`, errorText)
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          
          const result = await response.json()
          
          if (!result.success) {
            console.error(`削除失敗: 記録ID ${recordId}`, result)
            throw new Error(result.error || `記録ID ${recordId} の削除に失敗しました`)
          }
          
          console.log(`✅ 記録ID ${recordId} を削除しました`)
        }
        
        console.log('=== すべての削除処理完了 ===')
        
        // データを再読み込み
        console.log('データ再読み込み開始...')
        await Promise.all([
          loadExerciseRecords(),
          loadStats(),
          loadFamilyStats()
        ])
        console.log('データ再読み込み完了')
        
        // モーダルを閉じる
        console.log('モーダルを閉じます')
        showResetConfirm.value = false
        closeDayDetails()
        
        console.log('成功メッセージを表示')
        showSuccess(`${recordCount}件のエクササイズ記録を削除しました`)
        
        console.log('=== リセット処理正常終了 ===')
      } catch (error) {
        console.error('=== リセットエラー発生 ===')
        console.error('エラー詳細:', error)
        console.error('エラースタック:', error.stack)
        showError(`記録の削除に失敗しました: ${error.message}`)
      }
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
    const showPraiseAnimation = (message, type = 'daily', animationType = 'bounce', isMilestone = false) => {
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
      praiseClass.value = [...new Set(['praise-message', type, animationType, 'milestone'])].join(' ')
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
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']
      
      for (let i = 0; i < 50; i++) {
        confettiTimers.push(setTimeout(() => {
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
          
          confettiTimers.push(setTimeout(() => {
            const index = confettiElements.indexOf(confetti)
            if (index !== -1) {
              confettiElements.splice(index, 1)
            }
            if (confetti.parentNode) {
              confetti.parentNode.removeChild(confetti)
            }
          }, 3000))
        }, i * 50))
      }
    }

    // ユーザー管理機能
    const loadUsers = async () => {
      try {
        const response = await fetch('/api/users')
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const result = await response.json()
        
        if (!result.success) {
          throw new Error(result.error || 'ユーザーデータの読み込みに失敗しました')
        }
        
        users.value = result.users
        
        // 初期ユーザーの自動設定
        if (!currentUser.value && users.value.length > 0) {
          currentUser.value = users.value[0]
          await loadUserData()
        }
      } catch (error) {
        console.error('ユーザー読み込みエラー:', error)
        showError(`ユーザーデータの読み込みに失敗しました: ${error.message}`)
        users.value = []
      }
    }

    const switchUser = async (user) => {
      if (currentUser.value?.id === user.id) {
        showUserSelector.value = false
        return
      }
      
      // ローディング状態を表示
      const appElement = document.querySelector('.app')
      if (appElement) {
        appElement.classList.add('user-switching')
      }
      
      currentUser.value = user
      showUserSelector.value = false
      
      try {
        await loadUserData()
      } finally {
        // ローディング状態を解除
        if (appElement) {
          appElement.classList.remove('user-switching')
        }
      }
    }

    const loadUserData = async () => {
      if (!currentUser.value) return
      
      // ローディング状態を表示
      const loadingOverlay = document.createElement('div')
      loadingOverlay.className = 'loading-overlay'
      loadingOverlay.innerHTML = `
        <div class="loading-message">
          <div class="loading-spinner"></div>
          <div class="loading-text">データを読み込み中...</div>
        </div>
      `
      document.body.appendChild(loadingOverlay)
      
      try {
        // ユーザー切り替え時にデータを並行読み込み（パフォーマンス最適化）
        await Promise.all([
          loadExerciseRecords(),
          loadStats(),
          loadFamilyStats()
        ])
      } finally {
        // ローディング状態を解除
        if (loadingOverlay.parentNode) {
          loadingOverlay.parentNode.removeChild(loadingOverlay)
        }
      }
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

    // データ読み込み
    const loadExerciseRecords = async () => {
      try {
        const response = await fetch(`/api/records?userId=${currentUser.value.id}`)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const result = await response.json()
        
        if (!result.success) {
          throw new Error(result.error || '記録の読み込みに失敗しました')
        }
        
        exerciseRecords.value = result.records || []
      } catch (error) {
        console.error('記録読み込みエラー:', error)
        showError(`記録の読み込みに失敗しました: ${error.message}`)
        exerciseRecords.value = [] // エラー時は空配列
      }
    }

    const loadExercises = async () => {
      try {
        const response = await fetch('/api/exercises')
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const result = await response.json()
        
        if (!result.success) {
          throw new Error(result.error || 'エクササイズデータの読み込みに失敗しました')
        }
        
        exercises.value = result.exercises || []
        selectedExercise.value = null
      } catch (error) {
        console.error('エクササイズ読み込みエラー:', error)
        showError(`エクササイズデータの読み込みに失敗しました: ${error.message}`)
        exercises.value = []
      }
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

    const loadStats = async () => {
      try {
        const response = await fetch(`/api/stats?userId=${currentUser.value.id}`)
        const result = await response.json()
        if (result.success) {
          stats.value = result.stats
        }
      } catch (error) {
        console.error('統計読み込みエラー:', error)
      }
    }

    const loadFamilyStats = async () => {
      try {
        const response = await fetch('/api/family-stats')
        const result = await response.json()
        if (result.success) {
          familyStats.value = result.stats
        }
      } catch (error) {
        console.error('家族統計読み込みエラー:', error)
      }
    }

    // データ管理機能
    const createBackup = async () => {
      try {
        const response = await fetch('/api/backup')
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const result = await response.json()
        
        if (result.success) {
          showSuccess(`バックアップが作成されました: ${result.backupFile}`)
        } else {
          throw new Error(result.error || 'バックアップの作成に失敗しました')
        }
      } catch (error) {
        console.error('バックアップエラー:', error)
        showError(`バックアップの作成に失敗しました: ${error.message}`)
      }
    }

    const exportData = async () => {
      if (!currentUser.value) {
        showError('ユーザーが選択されていません')
        return
      }
      
      try {
        const response = await fetch(`/api/export?userId=${currentUser.value.id}`)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        // ファイルダウンロード
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `exercise-data-${currentUser.value.display_name}-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        
        showSuccess('データのエクスポートが完了しました')
      } catch (error) {
        console.error('エクスポートエラー:', error)
        showError(`データのエクスポートに失敗しました: ${error.message}`)
      }
    }

    // ユーザー管理用の状態
    const showUserManagement = ref(false)
    const showAddUser = ref(false)
    const showEditUser = ref(false)
    const newUserName = ref('')
    const newUserColor = ref('blue')
    const editUserName = ref('')

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
    }

    const toggleEditUser = () => {
      showEditUser.value = !showEditUser.value
      editUserName.value = currentUser.value?.display_name || ''
    }

    // ユーザー追加
    const addUser = async () => {
      if (!newUserName.value.trim()) {
        showError('ユーザー名を入力してください')
        return
      }
      
      try {
        const response = await fetch('/api/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: newUserName.value.trim(),
            colorTheme: newUserColor.value
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          await loadUsers()
          showAddUser.value = false
          newUserName.value = ''
          showSuccess('ユーザーを追加しました')
        } else {
          showError(result.error || 'ユーザーの追加に失敗しました')
        }
      } catch (error) {
        console.error('ユーザー追加エラー:', error)
        showError('ユーザーの追加に失敗しました')
      }
    }

    // ユーザー名更新
    const updateUserName = async () => {
      if (!editUserName.value.trim()) {
        showError('ユーザー名を入力してください')
        return
      }
      
      try {
        const response = await fetch('/api/user/name', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.value.id,
            displayName: editUserName.value.trim()
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          currentUser.value.display_name = editUserName.value.trim()
          await loadUsers()
          showEditUser.value = false
          showSuccess('ユーザー名を更新しました')
        } else {
          showError(result.error || 'ユーザー名の更新に失敗しました')
        }
      } catch (error) {
        console.error('ユーザー名更新エラー:', error)
        showError('ユーザー名の更新に失敗しました')
      }
    }
    // デフォルトエクササイズ設定用の状態
    const showDefaultExerciseSettings = ref(false)

    // デフォルトエクササイズ更新
    const updateDefaultExercise = async (exerciseId) => {
      try {
        const response = await fetch('/api/user/default-exercise', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.value.id,
            exerciseId: exerciseId
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          // ユーザー情報を更新
          currentUser.value.default_exercise_id = exerciseId
          showDefaultExerciseSettings.value = false
          showSuccess('デフォルトエクササイズを更新しました')
        } else {
          showError(result.error || 'デフォルトエクササイズの更新に失敗しました')
        }
      } catch (error) {
        console.error('デフォルトエクササイズ更新エラー:', error)
        showError('デフォルトエクササイズの更新に失敗しました')
      }
    }

    // デフォルトエクササイズ設定の切り替え
    const toggleDefaultExerciseSettings = () => {
      showDefaultExerciseSettings.value = !showDefaultExerciseSettings.value
    }
    // エクササイズの追加・削除機能
    const addExerciseToDay = async (date, exerciseId) => {
      try {
        const response = await fetch('/api/add-exercise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.value.id,
            exerciseId: exerciseId,
            date: date
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          await loadExerciseRecords()
          // 選択された日のデータを更新
          const updatedDay = calendarDays.value.find(day => day.date === date)
          if (updatedDay) {
            selectedDay.value = updatedDay
          }
          showSuccess('エクササイズを追加しました')
        } else {
          showError(result.error || 'エクササイズの追加に失敗しました')
        }
      } catch (error) {
        console.error('エクササイズ追加エラー:', error)
        showError('エクササイズの追加に失敗しました')
      }
    }

    const removeExerciseFromDay = async (recordId) => {
      try {
        const response = await fetch('/api/remove-exercise', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordId: recordId
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          await loadExerciseRecords()
          // 選択された日のデータを更新
          if (selectedDay.value) {
            const updatedDay = calendarDays.value.find(day => day.date === selectedDay.value.date)
            if (updatedDay) {
              selectedDay.value = updatedDay
            }
          }
          showSuccess('エクササイズを削除しました')
        } else {
          showError(result.error || 'エクササイズの削除に失敗しました')
        }
      } catch (error) {
        console.error('エクササイズ削除エラー:', error)
        showError('エクササイズの削除に失敗しました')
      }
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
      console.log('toggleAddExercise called, current state:', showAddExercise.value)
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
    onMounted(() => {
      // ユーザー読み込みから開始
      loadUsers()
      loadExercises()
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
      exportData
    }
  },

  template: `
    <div class="app">
      <!-- ヘッダー -->
      <header class="header">
        <h1>エクササイズカレンダー</h1>
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
                <!-- 済スタンプ -->
                <div v-if="day.status === 'completed' || day.status === 'multiple-completed'" 
                     :class="[
                       'stamp-done', 
                       { 
                         'stamp-large': day.recordCount === 2,
                         'stamp-xlarge': day.recordCount >= 3
                       }
                     ]">
                  済
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
            <h4 class="data-management-title">📊 データ管理</h4>
            <div class="data-management-buttons">
              <button class="backup-button" @click="createBackup">
                💾 バックアップ作成
              </button>
              <button class="export-button" @click="exportData">
                📤 データエクスポート
              </button>
            </div>
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
            <!-- 現在のユーザー編集 -->
            <div class="current-user-section">
              <h4>現在のユーザー: {{ currentUser?.display_name }}</h4>
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
  const recordDates = new Set(exerciseRecords.map(record => record.record_date))
  
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
    const dayRecords = exerciseRecords.filter(record => record.record_date === dateString)
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
  const recordDates = [...new Set(exerciseRecords.map(record => record.record_date))]
    .sort()
    .map(dateStr => {
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
        currentStreak.forEach(date => {
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
    currentStreak.forEach(date => {
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