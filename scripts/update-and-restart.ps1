# ==============================================================================
# Simple Exercise Calendar 自動更新 & 再起動スクリプト
# ==============================================================================

# 出力文字コードを UTF-8 に設定
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Simple Exercise Calendar 自動更新 & 再起動スクリプト   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. リポジトリルートディレクトリの特定
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) {
    $scriptDir = $PSScriptRoot
}
$repoRoot = (Resolve-Path "$scriptDir\..").Path
Set-Location $repoRoot
Write-Host "📂 作業ディレクトリ: $repoRoot" -ForegroundColor Gray

# 2. 前提コマンド (git, npm, pm2) の確認
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ git コマンドが見つかりません。Git for Windows がインストールされているか確認してください。" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npm コマンドが見つかりません。Node.js がインストールされているか確認してください。" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Host "❌ pm2 コマンドが見つかりません。PM2 がインストールされているか確認してください。" -ForegroundColor Red
    Write-Host "💡 インストール方法: npm install -g pm2" -ForegroundColor Yellow
    exit 1
}

# 3. PM2 プロセス 'exercise-calendar' の登録確認
# cmd /c を経由することで、PowerShell 5.1 の NativeCommandError を防止
cmd /c "pm2 describe exercise-calendar >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ PM2 に 'exercise-calendar' が登録されていません。" -ForegroundColor Red
    Write-Host "💡 初回起動の場合は、以下のコマンドで PM2 に登録してください:" -ForegroundColor Yellow
    Write-Host "   pm2 start server.js --name `"exercise-calendar`"" -ForegroundColor White
    Write-Host "   pm2 save" -ForegroundColor White
    exit 1
}

# 4. 未コミット変更のチェック (追跡対象ファイルの未コミット変更のみを検出し、存在する場合は安全のため中断)
$gitStatus = git status --porcelain --untracked-files=no
if ($gitStatus) {
    Write-Host "❌ 未コミットの変更が検出されました。作業内容の損失を防ぐため、処理を中断します。" -ForegroundColor Red
    Write-Host "💡 手動で変更内容を確認・コミットするか、一時退避 (git stash) してから再実行してください。" -ForegroundColor Yellow
    exit 1
}

# 5. カレントブランチの取得 & リモートの取得確認
$currentBranch = (git branch --show-current).Trim()
if (-not $currentBranch) {
    $currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
}
if (-not $currentBranch) {
    $currentBranch = "main"
}

Write-Host "📡 リモートリポジトリの更新を確認中 (ブランチ: $currentBranch)..." -ForegroundColor Cyan
git fetch origin $currentBranch
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ git fetch に失敗しました。ネットワーク接続またはリモートリポジトリの設定を確認してください。" -ForegroundColor Red
    exit 1
}

# 6. バックエンドプロセスを安全に一時停止
Write-Host "🛑 安全な更新のため、サーバープロセスを一時停止します (pm2 stop)..." -ForegroundColor Cyan
& pm2 stop exercise-calendar
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ サーバープロセスの一時停止に失敗しました。更新を中止します。" -ForegroundColor Red
    exit 1
}

# 7〜11: プロセス停止後の安全な更新と復旧保護 (try-finally 構造)
$restartedOk = $false
try {
    # 7. プロセス停止直後のデータベース自動バックアップ
    $dbPath = Join-Path $repoRoot "exercise-app.db"
    $backupDir = Join-Path $repoRoot "backups"
    if (Test-Path $dbPath) {
        if (-not (Test-Path $backupDir)) {
            New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        }
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupPath = Join-Path $backupDir "exercise-app-backup-$timestamp.db"
        try {
            Copy-Item -Path $dbPath -Destination $backupPath -Force -ErrorAction Stop
            Write-Host "📦 データベースをバックアップしました: $backupPath" -ForegroundColor Cyan
        } catch {
            Write-Host "❌ データベースのバックアップに失敗しました: $_" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "ℹ️ データベースファイル (exercise-app.db) はまだ作成されていません。" -ForegroundColor DarkGray
    }

    # 8. 最新コードの取得 (Fast-Forward のみ許可)
    Write-Host "📥 ブランチ '$currentBranch' の最新コードを取得中 (git pull --ff-only)..." -ForegroundColor Cyan
    $prevCommit = (git rev-parse HEAD).Trim()

    git pull --ff-only origin $currentBranch
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ git pull (--ff-only) に失敗しました。Fast-forward できない変更または競合があります。" -ForegroundColor Red
        exit 1
    }
    $newCommit = (git rev-parse HEAD).Trim()

    # 9. package.json の差分検知 & 必要に応じたクリーンインストール (npm ci)
    $needNpmCi = $false
    $nodeModulesPath = Join-Path $repoRoot "node_modules"

    if (-not (Test-Path $nodeModulesPath)) {
        $needNpmCi = $true
    } elseif ($prevCommit -ne $newCommit) {
        $changedFiles = git diff --name-only $prevCommit $newCommit
        if ($changedFiles -match "package.*\.json") {
            $needNpmCi = $true
        }
    }

    if ($needNpmCi) {
        Write-Host "📦 依存パッケージの更新を検知しました。npm ci を実行します..." -ForegroundColor Cyan
        npm ci
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ npm ci に失敗しました。依存関係のインストールログを確認してください。" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "📦 依存パッケージの更新はありません。" -ForegroundColor Gray
    }

    # 10. プロセスの再起動 & PM2 状態保存
    Write-Host "🔄 サーバープロセスを再起動します (pm2 restart)..." -ForegroundColor Cyan
    & pm2 restart exercise-calendar
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ pm2 restart に失敗しました。" -ForegroundColor Red
        exit 1
    }

    Write-Host "💾 PM2 プロセス状態を保存中 (pm2 save)..." -ForegroundColor Cyan
    & pm2 save

    # 11. ヘルスチェック (/api/ping)
    Write-Host "🔍 サーバーのヘルスチェックを実行中 (http://localhost:3000/api/ping)..." -ForegroundColor Cyan
    $maxRetries = 15
    $retryCount = 0
    $isHealthy = $false

    while ($retryCount -lt $maxRetries) {
        $retryCount++
        Start-Sleep -Seconds 1
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:3000/api/ping" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($response -and ($response.status -eq "ok" -or "$response" -match '"status":\s*"ok"')) {
                $isHealthy = $true
                break
            }
        } catch {
            # 起動待機中
        }
    }

    if ($isHealthy) {
        $restartedOk = $true
        Write-Host "==========================================================" -ForegroundColor Green
        Write-Host "✅ サーバー再起動および動作確認に成功しました (待機時間: ${retryCount}秒)" -ForegroundColor Green
        Write-Host "==========================================================" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "==========================================================" -ForegroundColor Red
        Write-Host "❌ サーバーの起動確認に失敗しました。pm2 logs を確認してください" -ForegroundColor Red
        Write-Host "==========================================================" -ForegroundColor Red
        exit 1
    }
} finally {
    if (-not $restartedOk) {
        Write-Host "🔄 処理が中断されたため、サーバープロセスの復旧を試みます (pm2 restart)..." -ForegroundColor Yellow
        cmd /c "pm2 restart exercise-calendar >nul 2>&1"
    }
}
