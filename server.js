const express = require('express')
const path = require('path')
const sqlite3 = require('sqlite3').verbose()
const fs = require('fs')

const app = express()
const PORT = 3000

// JST時刻取得関数（シンプル版）
function getCurrentJSTTimestamp() {
  const now = new Date()
  // 日本時間での現在時刻を文字列として取得
  const jstString = now.toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' })
  return jstString.replace(' ', 'T') + '+09:00'
}

// JST日付文字列取得（シンプル版）
function getCurrentJSTDate() {
  const now = new Date()
  // 日本時間での現在日付を取得
  return now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

// データベース接続とエラーハンドリング
let db
const dbPath = path.join(__dirname, 'exercise-app.db')

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    // データベースファイルの存在確認
    if (!fs.existsSync(dbPath)) {
      console.error('❌ データベースファイルが見つかりません:', dbPath)
      console.log('💡 データベースを初期化してください: node database.js')
      reject(new Error('データベースファイルが存在しません'))
      return
    }

    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ データベース接続エラー:', err.message)
        reject(err)
      } else {
        console.log('✅ SQLiteデータベースに接続しました')
        
        // データベースの整合性チェック
        db.get('PRAGMA integrity_check', (err, result) => {
          if (err) {
            console.error('❌ データベース整合性チェックエラー:', err)
            reject(err)
          } else if (result.integrity_check !== 'ok') {
            console.error('❌ データベースの整合性に問題があります:', result.integrity_check)
            reject(new Error('データベース整合性エラー'))
          } else {
            console.log('✅ データベース整合性チェック完了')
            resolve()
          }
        })
      }
    })
  })
}

// データベース初期化
initializeDatabase().catch((err) => {
  console.error('データベース初期化に失敗しました:', err.message)
  process.exit(1)
})

// ミドルウェア
app.use(express.json())
app.use(express.static('public'))

// データベース操作の共通エラーハンドリング
function handleDatabaseError(err, res, operation = 'データベース操作') {
  console.error(`❌ ${operation}エラー:`, err)
  
  // エラーの種類に応じた適切なレスポンス
  if (err.code === 'SQLITE_BUSY') {
    return res.status(503).json({ 
      success: false, 
      error: 'データベースが一時的に利用できません。しばらく待ってから再試行してください。',
      code: 'DATABASE_BUSY'
    })
  } else if (err.code === 'SQLITE_CORRUPT') {
    return res.status(500).json({ 
      success: false, 
      error: 'データベースが破損しています。管理者にお問い合わせください。',
      code: 'DATABASE_CORRUPT'
    })
  } else if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(400).json({ 
      success: false, 
      error: 'データの制約違反です。入力内容を確認してください。',
      code: 'CONSTRAINT_VIOLATION'
    })
  } else {
    return res.status(500).json({ 
      success: false, 
      error: `${operation}中にエラーが発生しました。`,
      code: 'UNKNOWN_ERROR'
    })
  }
}

// データベース接続状態チェック
function checkDatabaseConnection(req, res, next) {
  if (!db) {
    return res.status(503).json({
      success: false,
      error: 'データベースに接続できません。',
      code: 'DATABASE_UNAVAILABLE'
    })
  }
  next()
}

// 全APIにデータベース接続チェックを適用
app.use('/api/*', checkDatabaseConnection)

// API: データバックアップ
app.get('/api/backup', (req, res) => {
  try {
    const backupDir = path.join(__dirname, 'backups')
    
    // バックアップディレクトリを作成
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(backupDir, `exercise-app-backup-${timestamp}.db`)
    
    // データベースファイルをコピー
    fs.copyFile(dbPath, backupPath, (err) => {
      if (err) {
        return handleDatabaseError(err, res, 'バックアップ作成')
      }
      
      console.log(`✅ バックアップを作成しました: ${backupPath}`)
      res.json({ 
        success: true, 
        message: 'バックアップが正常に作成されました',
        backupFile: path.basename(backupPath)
      })
    })
  } catch (error) {
    handleDatabaseError(error, res, 'バックアップ作成')
  }
})

// API: データエクスポート（JSON形式）
app.get('/api/export', (req, res) => {
  try {
    const { userId } = req.query
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'ユーザーIDが必要です'
      })
    }
    
    // ユーザーのすべてのデータを取得
    const exportQuery = `
      SELECT 
        er.id,
        er.record_date,
        er.is_quick_record,
        er.notes,
        er.created_at,
        e.name as exercise_name,
        e.category as exercise_category,
        e.unit as exercise_unit,
        u.display_name as user_name
      FROM exercise_records er
      JOIN exercises e ON er.exercise_id = e.id
      JOIN users u ON er.user_id = u.id
      WHERE er.user_id = ?
      ORDER BY er.record_date DESC
    `
    
    db.all(exportQuery, [userId], (err, records) => {
      if (err) {
        return handleDatabaseError(err, res, 'データエクスポート')
      }
      
      const exportData = {
        exportDate: new Date().toISOString(),
        userId: userId,
        totalRecords: records.length,
        records: records
      }
      
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="exercise-data-user${userId}-${new Date().toISOString().split('T')[0]}.json"`)
      res.json(exportData)
    })
  } catch (error) {
    handleDatabaseError(error, res, 'データエクスポート')
  }
})

// API: ユーザー一覧取得
app.get('/api/users', (req, res) => {
  try {
    const query = 'SELECT id, username, display_name, color_theme, default_exercise_id FROM users ORDER BY id'
    
    db.all(query, [], (err, users) => {
      if (err) {
        return handleDatabaseError(err, res, 'ユーザー一覧取得')
      }
      
      if (!users || users.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'ユーザーが見つかりません。データベースを初期化してください。',
          code: 'NO_USERS_FOUND'
        })
      }
      
      res.json({ success: true, users })
    })
  } catch (error) {
    handleDatabaseError(error, res, 'ユーザー一覧取得')
  }
})

// API: エクササイズ一覧取得
app.get('/api/exercises', (req, res) => {
  try {
    db.all('SELECT * FROM exercises WHERE is_active = 1', [], (err, exercises) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message })
      }
      res.json({ success: true, exercises })
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// API: 記録一覧取得
app.get('/api/records', (req, res) => {
  try {
    const { userId } = req.query
    const query = `
      SELECT 
        er.*,
        e.name as exercise_name,
        e.category as exercise_category,
        e.icon as exercise_icon
      FROM exercise_records er
      JOIN exercises e ON er.exercise_id = e.id
      WHERE er.user_id = ? 
      ORDER BY er.record_date DESC
    `
    db.all(query, [userId], (err, records) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message })
      }
      res.json({ success: true, records })
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// API: 日付記録（エクササイズ指定なし）
app.post('/api/record-day', (req, res) => {
  try {
    const { userId, date } = req.body
    
    if (!userId || !date) {
      return res.status(400).json({ 
        success: false, 
        error: 'ユーザーIDと日付は必須です',
        code: 'MISSING_REQUIRED_FIELDS'
      })
    }
    
    // 未来の日付チェック
    const today = getCurrentJSTDate()
    if (date > today) {
      return res.status(400).json({ 
        success: false, 
        error: '未来の日付は記録できません',
        code: 'FUTURE_DATE_NOT_ALLOWED'
      })
    }
    
    // ユーザーのデフォルトエクササイズを取得
    const userQuery = 'SELECT default_exercise_id FROM users WHERE id = ?'
    
    db.get(userQuery, [userId], (err, user) => {
      if (err) {
        return handleDatabaseError(err, res, 'ユーザー情報取得')
      }
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: 'ユーザーが見つかりません'
        })
      }
      
      const defaultExerciseId = user.default_exercise_id || 5 // フォールバック: ランニング
      
      // 既存記録チェック
      const checkQuery = `
        SELECT COUNT(*) as count 
        FROM exercise_records 
        WHERE user_id = ? AND record_date = ?
      `
      
      db.get(checkQuery, [userId, date], (err, row) => {
        if (err) {
          return handleDatabaseError(err, res, '重複チェック')
        }
        
        if (row.count > 0) {
          // 既に記録がある場合
          return res.json({ 
            success: true, 
            isDuplicate: true,
            message: '既に記録済みです',
            praise: '今日はもう頑張りました！'
          })
        }
        
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            return handleDatabaseError(err, res, 'トランザクション開始')
          }
          
          const insertQuery = `
            INSERT INTO exercise_records (user_id, exercise_id, record_date, is_quick_record, created_at)
            VALUES (?, ?, ?, 1, ?)
          `
          
          db.run(insertQuery, [userId, defaultExerciseId, date, getCurrentJSTTimestamp()], function(err) {
            if (err) {
              db.run('ROLLBACK')
              return handleDatabaseError(err, res, '記録挿入')
            }
            
            db.run('COMMIT', (err) => {
              if (err) {
                console.error('コミットエラー:', err)
                return handleDatabaseError(err, res, 'トランザクション完了')
              }
              
              console.log(`✅ 日付記録を追加しました: ユーザー${userId}, エクササイズ${defaultExerciseId}, 日付${date}`)
              
              // 褒めメッセージ生成
              generatePraiseMessage(userId, date, (praiseData) => {
                res.json({ 
                  success: true, 
                  praise: praiseData.message,
                  praiseType: praiseData.type,
                  animationType: praiseData.animationType,
                  isMilestone: praiseData.isMilestone || false,
                  recordId: this.lastID
                })
              })
            })
          })
        })
      })
    })
  } catch (error) {
    handleDatabaseError(error, res, '日付記録API')
  }
})

// API: ユーザー名更新
app.put('/api/user/name', (req, res) => {
  try {
    const { userId, displayName } = req.body
    
    if (!userId || !displayName) {
      return res.status(400).json({ 
        success: false, 
        error: 'ユーザーIDと表示名は必須です',
        code: 'MISSING_REQUIRED_FIELDS'
      })
    }
    
    const updateQuery = 'UPDATE users SET display_name = ? WHERE id = ?'
    
    db.run(updateQuery, [displayName, userId], function(err) {
      if (err) {
        return handleDatabaseError(err, res, 'ユーザー名更新')
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'ユーザーが見つかりません'
        })
      }
      
      console.log(`✅ ユーザー${userId}の名前を「${displayName}」に更新しました`)
      res.json({ 
        success: true, 
        message: 'ユーザー名を更新しました'
      })
    })
  } catch (error) {
    handleDatabaseError(error, res, 'ユーザー名更新API')
  }
})

// API: ユーザー追加
app.post('/api/user', (req, res) => {
  try {
    const { displayName, colorTheme } = req.body
    
    if (!displayName) {
      return res.status(400).json({ 
        success: false, 
        error: '表示名は必須です',
        code: 'MISSING_REQUIRED_FIELDS'
      })
    }
    
    // ユーザー名からusernameを生成
    const username = `user${Date.now()}`
    const theme = colorTheme || 'blue'
    const defaultExerciseId = 5 // ランニング
    
    const insertQuery = `
      INSERT INTO users (username, display_name, color_theme, default_exercise_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `
    
    db.run(insertQuery, [username, displayName, theme, defaultExerciseId, getCurrentJSTTimestamp()], function(err) {
      if (err) {
        return handleDatabaseError(err, res, 'ユーザー追加')
      }
      
      const newUser = {
        id: this.lastID,
        username: username,
        display_name: displayName,
        color_theme: theme,
        default_exercise_id: defaultExerciseId
      }
      
      console.log(`✅ 新しいユーザーを追加しました: ${displayName} (ID: ${this.lastID})`)
      res.json({ 
        success: true, 
        message: 'ユーザーを追加しました',
        user: newUser
      })
    })
  } catch (error) {
    handleDatabaseError(error, res, 'ユーザー追加API')
  }
})

// API: デフォルトエクササイズ更新
app.put('/api/user/default-exercise', (req, res) => {
  try {
    const { userId, exerciseId } = req.body
    
    if (!userId || !exerciseId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ユーザーIDとエクササイズIDは必須です',
        code: 'MISSING_REQUIRED_FIELDS'
      })
    }
    
    const updateQuery = 'UPDATE users SET default_exercise_id = ? WHERE id = ?'
    
    db.run(updateQuery, [exerciseId, userId], function(err) {
      if (err) {
        return handleDatabaseError(err, res, 'デフォルトエクササイズ更新')
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'ユーザーが見つかりません'
        })
      }
      
      console.log(`✅ ユーザー${userId}のデフォルトエクササイズを${exerciseId}に更新しました`)
      res.json({ 
        success: true, 
        message: 'デフォルトエクササイズを更新しました'
      })
    })
  } catch (error) {
    handleDatabaseError(error, res, 'デフォルトエクササイズ更新API')
  }
})

// API: エクササイズ追加
app.post('/api/add-exercise', (req, res) => {
  try {
    const { userId, exerciseId, date } = req.body
    
    if (!userId || !exerciseId || !date) {
      return res.status(400).json({ 
        success: false, 
        error: 'ユーザーID、エクササイズID、日付は必須です',
        code: 'MISSING_REQUIRED_FIELDS'
      })
    }
    
    // 重複チェック
    const checkQuery = `
      SELECT COUNT(*) as count 
      FROM exercise_records 
      WHERE user_id = ? AND exercise_id = ? AND record_date = ?
    `
    
    db.get(checkQuery, [userId, exerciseId, date], (err, row) => {
      if (err) {
        return handleDatabaseError(err, res, '重複チェック')
      }
      
      if (row.count > 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'このエクササイズは既に記録済みです'
        })
      }
      
      const insertQuery = `
        INSERT INTO exercise_records (user_id, exercise_id, record_date, is_quick_record, created_at)
        VALUES (?, ?, ?, 0, ?)
      `
      
      db.run(insertQuery, [userId, exerciseId, date, getCurrentJSTTimestamp()], function(err) {
        if (err) {
          return handleDatabaseError(err, res, 'エクササイズ追加')
        }
        
        console.log(`✅ エクササイズを追加しました: ユーザー${userId}, エクササイズ${exerciseId}, 日付${date}`)
        res.json({ 
          success: true, 
          message: 'エクササイズを追加しました',
          recordId: this.lastID
        })
      })
    })
  } catch (error) {
    handleDatabaseError(error, res, 'エクササイズ追加API')
  }
})

// API: エクササイズ削除
app.delete('/api/remove-exercise', (req, res) => {
  try {
    const { recordId } = req.body
    
    if (!recordId) {
      return res.status(400).json({ 
        success: false, 
        error: '記録IDは必須です',
        code: 'MISSING_REQUIRED_FIELDS'
      })
    }
    
    const deleteQuery = 'DELETE FROM exercise_records WHERE id = ?'
    
    db.run(deleteQuery, [recordId], function(err) {
      if (err) {
        return handleDatabaseError(err, res, 'エクササイズ削除')
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ 
          success: false, 
          error: '指定された記録が見つかりません'
        })
      }
      
      console.log(`✅ エクササイズを削除しました: 記録ID${recordId}`)
      res.json({ 
        success: true, 
        message: 'エクササイズを削除しました'
      })
    })
  } catch (error) {
    handleDatabaseError(error, res, 'エクササイズ削除API')
  }
})

// API: 「今日やった」記録（従来版）
app.post('/api/record', (req, res) => {
  try {
    const { userId, exerciseId, date } = req.body
    
    // 入力値検証を強化
    if (!userId || !exerciseId || !date) {
      return res.status(400).json({ 
        success: false, 
        error: '必要なパラメータが不足しています（ユーザーID、エクササイズID、日付）',
        code: 'MISSING_PARAMETERS'
      })
    }
    
    // 日付形式の検証
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        error: '日付の形式が正しくありません（YYYY-MM-DD形式で入力してください）',
        code: 'INVALID_DATE_FORMAT'
      })
    }
    
    // 未来の日付チェック
    const inputDate = new Date(date)
    const today = new Date()
    // 未来の日付チェック（JST基準）
    const todayJST = new Date(getCurrentJSTDate())
    todayJST.setHours(23, 59, 59, 999) // 今日の終わりまで許可
    
    if (inputDate > todayJST) {
      return res.status(400).json({
        success: false,
        error: '未来の日付は記録できません',
        code: 'FUTURE_DATE_NOT_ALLOWED'
      })
    }
    
    // トランザクション開始
    db.serialize(() => {
      db.run('BEGIN TRANSACTION')
      
      // 既存記録をチェック
      const checkQuery = `
        SELECT id FROM exercise_records 
        WHERE user_id = ? AND exercise_id = ? AND record_date = ?
      `
      
      db.get(checkQuery, [userId, exerciseId, date], (err, existing) => {
        if (err) {
          db.run('ROLLBACK')
          return handleDatabaseError(err, res, '記録チェック')
        }
        
        if (existing) {
          db.run('ROLLBACK')
          return res.json({ 
            success: true, 
            message: '既に記録済みです',
            praise: '今日はもう頑張りました！',
            isDuplicate: true
          })
        }
        
        // ユーザーとエクササイズの存在確認
        const validateQuery = `
          SELECT u.id as user_exists, e.id as exercise_exists
          FROM users u, exercises e
          WHERE u.id = ? AND e.id = ?
        `
        
        db.get(validateQuery, [userId, exerciseId], (err, validation) => {
          if (err) {
            db.run('ROLLBACK')
            return handleDatabaseError(err, res, 'データ検証')
          }
          
          if (!validation) {
            db.run('ROLLBACK')
            return res.status(400).json({
              success: false,
              error: '指定されたユーザーまたはエクササイズが存在しません',
              code: 'INVALID_USER_OR_EXERCISE'
            })
          }
          
          // 新規記録を挿入
          const insertQuery = `
            INSERT INTO exercise_records (user_id, exercise_id, record_date, is_quick_record, created_at)
            VALUES (?, ?, ?, 1, ?)
          `
          
          db.run(insertQuery, [userId, exerciseId, date, getCurrentJSTTimestamp()], function(err) {
            if (err) {
              db.run('ROLLBACK')
              return handleDatabaseError(err, res, '記録挿入')
            }
            
            // トランザクション完了
            db.run('COMMIT', (err) => {
              if (err) {
                console.error('コミットエラー:', err)
                return handleDatabaseError(err, res, 'トランザクション完了')
              }
              
              console.log(`✅ 新しい記録を追加しました: ユーザー${userId}, エクササイズ${exerciseId}, 日付${date}`)
              
              // 褒めメッセージ生成（連続記録を考慮）
              generatePraiseMessage(userId, date, (praiseData) => {
                res.json({ 
                  success: true, 
                  praise: praiseData.message,
                  praiseType: praiseData.type,
                  animationType: praiseData.animationType,
                  isMilestone: praiseData.isMilestone || false,
                  recordId: this.lastID
                })
              })
            })
          })
        })
      })
    })
  } catch (error) {
    handleDatabaseError(error, res, '記録API')
  }
})

// 褒めメッセージ生成（連続記録とマイルストーンを考慮）
function generatePraiseMessage(userId, currentDate, callback) {
  // 過去の記録を取得して連続記録を計算
  const streakQuery = `
    SELECT DISTINCT record_date 
    FROM exercise_records 
    WHERE user_id = ? 
    ORDER BY record_date DESC 
    LIMIT 60
  `
  
  // 総記録数も取得
  const totalQuery = `
    SELECT COUNT(*) as total_records
    FROM exercise_records 
    WHERE user_id = ?
  `
  
  db.all(streakQuery, [userId], (err, records) => {
    if (err) {
      console.error('連続記録取得エラー:', err)
      return callback({
        message: '今日やってえらい！',
        type: 'daily',
        animationType: 'bounce'
      })
    }
    
    db.get(totalQuery, [userId], (err, totalResult) => {
      if (err) {
        console.error('総記録数取得エラー:', err)
        return callback({
          message: '今日やってえらい！',
          type: 'daily',
          animationType: 'bounce'
        })
      }
      
      // 連続記録日数を計算
      const streakDays = calculateCurrentStreak(records, currentDate)
      const totalRecords = totalResult.total_records
      
      // マイルストーンチェック
      const milestone = checkMilestone(streakDays, totalRecords)
      
      if (milestone) {
        callback(milestone)
      } else {
        // 通常の連続記録メッセージ
        callback(generateStreakMessage(streakDays))
      }
    })
  })
}

// マイルストーン検出
function checkMilestone(streakDays, totalRecords) {
  // 連続記録のマイルストーン
  const streakMilestones = [
    { days: 100, message: '100日連続！🎊 伝説の領域！', type: 'legendary', animationType: 'celebration' },
    { days: 50, message: '50日連続！🏆 もはや達人！', type: 'master', animationType: 'fireworks' },
    { days: 30, message: '30日連続！🎯 完全に習慣化！', type: 'habit', animationType: 'rainbow' },
    { days: 21, message: '21日連続！🌟 習慣形成完了！', type: 'milestone', animationType: 'sparkle' },
    { days: 14, message: '14日連続！🔥 2週間達成！', type: 'milestone', animationType: 'fire' },
    { days: 10, message: '10日連続！⭐ 二桁達成！', type: 'milestone', animationType: 'star' },
    { days: 7, message: '7日連続！🎉 1週間達成！', type: 'milestone', animationType: 'confetti' }
  ]
  
  // 総記録数のマイルストーン
  const totalMilestones = [
    { count: 365, message: '365回達成！🎊 1年分の記録！', type: 'legendary', animationType: 'celebration' },
    { count: 200, message: '200回達成！🏆 継続の王者！', type: 'master', animationType: 'fireworks' },
    { count: 100, message: '100回達成！🎯 三桁の壁突破！', type: 'milestone', animationType: 'rainbow' },
    { count: 50, message: '50回達成！🌟 半世紀達成！', type: 'milestone', animationType: 'sparkle' },
    { count: 30, message: '30回達成！⭐ 継続の力！', type: 'milestone', animationType: 'star' },
    { count: 10, message: '10回達成！🎉 二桁突入！', type: 'milestone', animationType: 'confetti' }
  ]
  
  // 連続記録マイルストーンをチェック
  for (const milestone of streakMilestones) {
    if (streakDays === milestone.days) {
      return {
        message: milestone.message,
        type: milestone.type,
        animationType: milestone.animationType,
        isMilestone: true
      }
    }
  }
  
  // 総記録数マイルストーンをチェック
  for (const milestone of totalMilestones) {
    if (totalRecords === milestone.count) {
      return {
        message: milestone.message,
        type: milestone.type,
        animationType: milestone.animationType,
        isMilestone: true
      }
    }
  }
  
  return null
}

// 通常の連続記録メッセージ生成
function generateStreakMessage(streakDays) {
  if (streakDays >= 30) {
    return {
      message: `${streakDays}日連続！もはや習慣！🎉`,
      type: 'streak-long',
      animationType: 'pulse'
    }
  } else if (streakDays >= 14) {
    return {
      message: `${streakDays}日連続！すごすぎる！🔥`,
      type: 'streak-medium',
      animationType: 'pulse'
    }
  } else if (streakDays >= 7) {
    return {
      message: `${streakDays}日連続！1週間達成！⭐`,
      type: 'streak-week',
      animationType: 'bounce'
    }
  } else if (streakDays >= 3) {
    return {
      message: `${streakDays}日連続！調子いいね！💪`,
      type: 'streak-short',
      animationType: 'bounce'
    }
  } else if (streakDays >= 2) {
    return {
      message: `${streakDays}日連続！その調子！👍`,
      type: 'streak-start',
      animationType: 'bounce'
    }
  } else {
    // 1日目または連続が途切れた場合
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
}

// 現在の連続記録日数を計算
function calculateCurrentStreak(records, currentDate) {
  if (!records || records.length === 0) return 1
  
  const currentDateObj = new Date(currentDate)
  let streak = 1 // 今日の分
  
  // 記録を日付順にソート
  const sortedRecords = records
    .map(r => new Date(r.record_date))
    .sort((a, b) => b - a) // 新しい順
  
  // 昨日から遡って連続日数をカウント
  let checkDate = new Date(currentDateObj)
  checkDate.setDate(checkDate.getDate() - 1) // 昨日から開始
  
  for (const recordDate of sortedRecords) {
    const recordDateStr = recordDate.toISOString().split('T')[0]
    const checkDateStr = checkDate.toISOString().split('T')[0]
    
    if (recordDateStr === checkDateStr) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1) // 前日に移動
    } else if (recordDate < checkDate) {
      // 連続が途切れた
      break
    }
  }
  
  return streak
}

// API: 統計情報取得
app.get('/api/stats', (req, res) => {
  try {
    const { userId } = req.query
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ユーザーIDが必要です' 
      })
    }
    
    // 総記録数
    const totalQuery = `
      SELECT COUNT(*) as total_records
      FROM exercise_records 
      WHERE user_id = ?
    `
    
    // 今月の記録数
    const thisMonthQuery = `
      SELECT COUNT(*) as month_records
      FROM exercise_records 
      WHERE user_id = ? 
      AND strftime('%Y-%m', record_date) = strftime('%Y-%m', 'now')
    `
    
    // 連続記録計算用の記録
    const streakQuery = `
      SELECT DISTINCT record_date 
      FROM exercise_records 
      WHERE user_id = ? 
      ORDER BY record_date DESC 
      LIMIT 100
    `
    
    db.get(totalQuery, [userId], (err, totalResult) => {
      if (err) {
        console.error('総記録数取得エラー:', err)
        return res.status(500).json({ success: false, error: err.message })
      }
      
      db.get(thisMonthQuery, [userId], (err, monthResult) => {
        if (err) {
          console.error('今月記録数取得エラー:', err)
          return res.status(500).json({ success: false, error: err.message })
        }
        
        db.all(streakQuery, [userId], (err, streakRecords) => {
          if (err) {
            console.error('連続記録取得エラー:', err)
            return res.status(500).json({ success: false, error: err.message })
          }
          
          // 現在の連続記録を計算
          const currentStreak = calculateCurrentStreakForStats(streakRecords)
          
          // 最長連続記録を計算
          const longestStreak = calculateLongestStreak(streakRecords)
          
          const stats = {
            totalRecords: totalResult.total_records,
            currentStreak: currentStreak,
            longestStreak: longestStreak,
            thisMonthRecords: monthResult.month_records
          }
          
          res.json({ success: true, stats })
        })
      })
    })
  } catch (error) {
    console.error('統計API エラー:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// API: 家族統計情報取得
app.get('/api/family-stats', (req, res) => {
  try {
    // 家族全体の総記録数
    const totalFamilyQuery = `
      SELECT COUNT(*) as total_family_records
      FROM exercise_records
    `
    
    // 今月活動中の家族メンバー数
    const activeMembersQuery = `
      SELECT COUNT(DISTINCT user_id) as active_members
      FROM exercise_records 
      WHERE strftime('%Y-%m', record_date) = strftime('%Y-%m', 'now')
    `
    
    // 今日の家族記録数
    const todayFamilyQuery = `
      SELECT COUNT(*) as today_family_records
      FROM exercise_records 
      WHERE record_date = date('now')
    `
    
    db.get(totalFamilyQuery, [], (err, totalResult) => {
      if (err) {
        console.error('家族総記録数取得エラー:', err)
        return res.status(500).json({ success: false, error: err.message })
      }
      
      db.get(activeMembersQuery, [], (err, activeResult) => {
        if (err) {
          console.error('活動メンバー数取得エラー:', err)
          return res.status(500).json({ success: false, error: err.message })
        }
        
        db.get(todayFamilyQuery, [], (err, todayResult) => {
          if (err) {
            console.error('今日の家族記録数取得エラー:', err)
            return res.status(500).json({ success: false, error: err.message })
          }
          
          const stats = {
            totalFamilyRecords: totalResult.total_family_records,
            activeFamilyMembers: activeResult.active_members,
            familyRecordsToday: todayResult.today_family_records
          }
          
          res.json({ success: true, stats })
        })
      })
    })
  } catch (error) {
    console.error('家族統計API エラー:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 統計用の現在連続記録計算
function calculateCurrentStreakForStats(records) {
  if (!records || records.length === 0) return 0
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  
  // 今日の記録があるかチェック
  const hasTodayRecord = records.some(r => r.record_date === todayStr)
  
  let streak = hasTodayRecord ? 1 : 0
  let checkDate = new Date(today)
  
  if (!hasTodayRecord) {
    // 今日の記録がない場合は昨日から開始
    checkDate.setDate(checkDate.getDate() - 1)
  } else {
    // 今日の記録がある場合は昨日から遡る
    checkDate.setDate(checkDate.getDate() - 1)
  }
  
  // 記録を日付順にソート
  const sortedRecords = records
    .map(r => new Date(r.record_date))
    .sort((a, b) => b - a) // 新しい順
  
  // 連続日数をカウント
  for (const recordDate of sortedRecords) {
    const recordDateStr = recordDate.toISOString().split('T')[0]
    const checkDateStr = checkDate.toISOString().split('T')[0]
    
    if (recordDateStr === checkDateStr) {
      if (hasTodayRecord || streak > 0) {
        streak++
      } else {
        streak = 1
      }
      checkDate.setDate(checkDate.getDate() - 1)
    } else if (recordDate < checkDate) {
      break
    }
  }
  
  return streak
}

// 最長連続記録を計算
function calculateLongestStreak(records) {
  if (!records || records.length === 0) return 0
  
  // 記録を日付順にソート
  const sortedRecords = records
    .map(r => new Date(r.record_date))
    .sort((a, b) => a - b) // 古い順
  
  let maxStreak = 1
  let currentStreak = 1
  
  for (let i = 1; i < sortedRecords.length; i++) {
    const prevDate = sortedRecords[i - 1]
    const currentDate = sortedRecords[i]
    
    // 連続する日かチェック
    const diffTime = currentDate - prevDate
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      currentStreak = 1
    }
  }
  
  return maxStreak
}

app.listen(PORT, () => {
  console.log(`サーバーがポート${PORT}で起動しました`)
  console.log(`http://localhost:${PORT} でアクセスできます`)
})