const sqlite3 = require('sqlite3').verbose()
const path = require('path')

// データベースファイルのパス
const dbPath = path.join(__dirname, 'exercise-app.db')

console.log('📊 データベースを初期化しています...')

// データベース接続
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ データベース接続エラー:', err.message)
    process.exit(1)
  }
  console.log('✅ SQLiteデータベースに接続しました')
})

// テーブル作成のSQL
const createTablesSQL = `
  -- ユーザーテーブル
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    color_theme TEXT DEFAULT 'blue',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- エクササイズ種目テーブル
  CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    icon TEXT,
    user_id INTEGER, -- NULL = システムデフォルト
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  -- エクササイズ記録テーブル
  CREATE TABLE IF NOT EXISTS exercise_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    record_date DATE NOT NULL,
    is_quick_record BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (exercise_id) REFERENCES exercises (id)
  );

  -- エクササイズセットテーブル（詳細記録用）
  CREATE TABLE IF NOT EXISTS exercise_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_record_id INTEGER NOT NULL,
    set_number INTEGER NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY (exercise_record_id) REFERENCES exercise_records (id)
  );

  -- 褒めメッセージテーブル
  CREATE TABLE IF NOT EXISTS praise_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'daily', 'streak', 'milestone'
    min_streak INTEGER DEFAULT 1,
    animation_type TEXT NOT NULL
  );

  -- インデックス作成
  CREATE INDEX IF NOT EXISTS idx_exercise_records_user_date ON exercise_records(user_id, record_date);
  CREATE INDEX IF NOT EXISTS idx_exercise_records_date ON exercise_records(record_date);

  -- ユニーク制約（重複記録防止）
  CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_exercise_date 
  ON exercise_records(user_id, exercise_id, record_date);
`

// 初期データ
const users = [
  ['user1', 'ユーザー1', 'blue'],
  ['user2', 'ユーザー2', 'green'],
  ['user3', 'ユーザー3', 'purple']
]

const exercises = [
  ['腹筋', '筋トレ', '回', '💪'],
  ['腕立て伏せ', '筋トレ', '回', '🤲'],
  ['スクワット', '筋トレ', '回', '🦵'],
  ['プランク', '筋トレ', '秒', '⏱️'],
  ['ランニング', '有酸素', '分', '🏃'],
  ['ウォーキング', '有酸素', '分', '🚶'],
  ['ストレッチ', 'その他', '分', '🧘'],
  ['ヨガ', 'その他', '分', '🧘‍♀️']
]

const praiseMessages = [
  // 日常の褒め
  ['今日やってえらい！', 'daily', 1, 'bounce'],
  ['素晴らしい！', 'daily', 1, 'bounce'],
  ['その調子！', 'daily', 1, 'bounce'],
  ['よくやった！', 'daily', 1, 'bounce'],
  ['継続は力なり！', 'daily', 1, 'bounce'],
  
  // 連続記録の褒め
  ['2日連続！すごい！', 'streak', 2, 'pulse'],
  ['3日連続！調子いいね！', 'streak', 3, 'pulse'],
  ['1週間継続！素晴らしい！', 'streak', 7, 'shake'],
  ['2週間継続！すごすぎる！', 'streak', 14, 'shake'],
  ['1ヶ月継続！もはや習慣！', 'streak', 30, 'rainbow'],
  
  // マイルストーン
  ['10回達成！', 'milestone', 10, 'fireworks'],
  ['50回達成！継続の力！', 'milestone', 50, 'fireworks'],
  ['100回達成！もう止まらない！', 'milestone', 100, 'celebration']
]

// 非同期でデータベース初期化を実行
async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    // テーブル作成
    db.exec(createTablesSQL, (err) => {
      if (err) {
        console.error('❌ テーブル作成エラー:', err.message)
        reject(err)
        return
      }
      console.log('✅ テーブルが作成されました')

      // ユーザーデータ投入
      const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, display_name, color_theme) VALUES (?, ?, ?)')
      
      let userPromises = users.map(([username, displayName, colorTheme]) => {
        return new Promise((resolve, reject) => {
          insertUser.run(username, displayName, colorTheme, function(err) {
            if (err) {
              console.error('❌ ユーザー追加エラー:', err.message)
              reject(err)
            } else {
              if (this.changes > 0) {
                console.log(`👤 ユーザー「${displayName}」を追加しました`)
              }
              resolve()
            }
          })
        })
      })

      // エクササイズデータ投入
      const insertExercise = db.prepare('INSERT OR IGNORE INTO exercises (name, category, unit, icon) VALUES (?, ?, ?, ?)')
      
      let exercisePromises = exercises.map(([name, category, unit, icon]) => {
        return new Promise((resolve, reject) => {
          insertExercise.run(name, category, unit, icon, function(err) {
            if (err) {
              console.error('❌ エクササイズ追加エラー:', err.message)
              reject(err)
            } else {
              if (this.changes > 0) {
                console.log(`🏃 エクササイズ「${name}」を追加しました`)
              }
              resolve()
            }
          })
        })
      })

      // 褒めメッセージデータ投入
      const insertPraise = db.prepare('INSERT OR IGNORE INTO praise_messages (message, type, min_streak, animation_type) VALUES (?, ?, ?, ?)')
      
      let praisePromises = praiseMessages.map(([message, type, minStreak, animationType]) => {
        return new Promise((resolve, reject) => {
          insertPraise.run(message, type, minStreak, animationType, function(err) {
            if (err) {
              console.error('❌ 褒めメッセージ追加エラー:', err.message)
              reject(err)
            } else {
              if (this.changes > 0) {
                console.log(`💬 褒めメッセージ「${message}」を追加しました`)
              }
              resolve()
            }
          })
        })
      })

      // すべての挿入が完了してから統計を表示
      Promise.all([...userPromises, ...exercisePromises, ...praisePromises])
        .then(() => {
          // prepared statementを終了
          insertUser.finalize()
          insertExercise.finalize()
          insertPraise.finalize()

          // 統計表示
          db.get('SELECT COUNT(*) as count FROM users', (err, userResult) => {
            if (err) {
              console.error('❌ ユーザー数取得エラー:', err.message)
              reject(err)
              return
            }

            db.get('SELECT COUNT(*) as count FROM exercises', (err, exerciseResult) => {
              if (err) {
                console.error('❌ エクササイズ数取得エラー:', err.message)
                reject(err)
                return
              }

              db.get('SELECT COUNT(*) as count FROM praise_messages', (err, praiseResult) => {
                if (err) {
                  console.error('❌ 褒めメッセージ数取得エラー:', err.message)
                  reject(err)
                  return
                }

                console.log('\n📊 データベース統計:')
                console.log(`   ユーザー数: ${userResult.count}`)
                console.log(`   エクササイズ種目数: ${exerciseResult.count}`)
                console.log(`   褒めメッセージ数: ${praiseResult.count}`)

                console.log('\n✅ データベースの初期化が完了しました！')
                console.log('🚀 次のコマンドでサーバーを起動できます: npm start')

                db.close((err) => {
                  if (err) {
                    console.error('❌ データベース切断エラー:', err.message)
                    reject(err)
                  } else {
                    console.log('✅ データベース接続を閉じました')
                    resolve()
                  }
                })
              })
            })
          })
        })
        .catch((err) => {
          console.error('❌ データ挿入エラー:', err)
          reject(err)
        })
    })
  })
}

// 初期化実行
initializeDatabase().catch((err) => {
  console.error('❌ データベース初期化に失敗しました:', err)
  process.exit(1)
})