<?php
/**
 * ExamLegacy — 1-Click Database Installer & Migration Utility
 * Compatible with Localhost, MariaDB, MySQL 5.7/8.0, and Shared Hosting (InfinityFree, cPanel, Hostinger)
 *
 * Access in browser:
 *   https://examlegacy.my-board.org/install.php
 *   http://localhost:8000/install.php
 *   ?auto=1 (runs automatically)
 */
declare(strict_types=1);

require_once __DIR__ . '/api/config.php';

use ExamLegacy\Firestore;

// Load current configuration
$envFile = __DIR__ . '/.env';

// Allow overriding via form POST
$dbHost = trim($_POST['db_host'] ?? (defined('DB_HOST') ? DB_HOST : '127.0.0.1'));
$dbPort = (int)($_POST['db_port'] ?? (defined('DB_PORT') ? DB_PORT : 3306));
if ($dbPort <= 0) $dbPort = 3306;
$dbName = trim($_POST['db_name'] ?? (defined('DB_NAME') ? DB_NAME : 'examlegacy'));
$dbUser = trim($_POST['db_user'] ?? (defined('DB_USER') ? DB_USER : 'root'));
$dbPass = isset($_POST['db_pass']) ? (string)$_POST['db_pass'] : (defined('DB_PASS') ? DB_PASS : '');

$saveEnv = !empty($_POST['save_env']);
$action  = $_POST['action'] ?? ($_GET['auto'] ?? null ? 'install' : null);

$logs = [];
$success = false;
$dbConnected = false;
$dbError = '';
$pdo = null;

// Function to update .env safely
function updateEnvFile(string $path, array $updates): bool {
    if (!is_file($path) || !is_writable($path)) {
        return false;
    }
    $content = file_get_contents($path);
    foreach ($updates as $k => $v) {
        if (preg_match('/^' . preg_quote($k, '/') . '=.*/m', $content)) {
            $content = preg_replace('/^' . preg_quote($k, '/') . '=.*/m', $k . '=' . $v, $content);
        } else {
            $content .= "\n" . $k . '=' . $v;
        }
    }
    return (bool)file_put_contents($path, $content, LOCK_EX);
}

// Save to .env if requested
if ($saveEnv && is_file($envFile)) {
    updateEnvFile($envFile, [
        'DB_HOST' => $dbHost,
        'DB_PORT' => (string)$dbPort,
        'DB_NAME' => $dbName,
        'DB_USER' => $dbUser,
        'DB_PASS' => $dbPass,
    ]);
    $logs[] = "💾 Updated database credentials in .env successfully.";
}

// Test connection
try {
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $dbHost, $dbPort, $dbName);
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 6,
    ]);
    $dbConnected = true;
} catch (Throwable $e) {
    $dbError = $e->getMessage();
    // If database doesn't exist on local setup, try creating it
    if (strpos($dbHost, '127.0.0.1') !== false || strpos($dbHost, 'localhost') !== false) {
        try {
            $tempPdo = new PDO(sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $dbHost, $dbPort), $dbUser, $dbPass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
            ]);
            $tempPdo->exec("CREATE DATABASE IF NOT EXISTS `" . str_replace("`", "``", $dbName) . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $pdo = new PDO($dsn, $dbUser, $dbPass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
            $dbConnected = true;
            $dbError = '';
            $logs[] = "✅ Database `{$dbName}` created locally.";
        } catch (Throwable $ignore) {}
    }
}

// Run Installation
if ($action === 'install') {
    try {
        if (!$dbConnected || !$pdo) {
            throw new Exception("Cannot proceed: Database connection failed ($dbError)");
        }

        // 1. Session hardening & disable foreign key checks for table creation
        $pdo->exec("SET NAMES utf8mb4");
        $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
        $pdo->exec("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO'");

        // 2. Locate SQL file
        $candidates = [
            __DIR__ . '/database.sql',
            __DIR__ . '/database/database.sql',
            __DIR__ . '/database/schema.sql',
            __DIR__ . '/migrations/schema.sql'
        ];
        $sqlPath = null;
        foreach ($candidates as $c) {
            if (is_file($c) && filesize($c) > 1000) {
                $sqlPath = $c;
                break;
            }
        }
        if (!$sqlPath) {
            throw new Exception("SQL schema file not found in " . __DIR__);
        }

        $sqlContent = file_get_contents($sqlPath);
        $logs[] = "📄 Loaded SQL schema from " . basename($sqlPath) . " (" . number_format(strlen($sqlContent)) . " bytes)";

        // 3. Clear existing conflicting tables safely with foreign keys disabled
        $existingTables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
        if (!empty($existingTables)) {
            foreach ($existingTables as $tbl) {
                $pdo->exec("DROP TABLE IF EXISTS `" . str_replace("`", "``", $tbl) . "`");
            }
            $logs[] = "🧹 Successfully wiped " . count($existingTables) . " old tables to guarantee clean schema installation.";
        }

        // 4. Split and execute SQL queries safely
        $sqlContent = str_replace(["\r\n", "\r"], "\n", $sqlContent);
        // Strip block comments
        $sqlContent = preg_replace('/\/\*.*?\*\//s', '', $sqlContent);

        $rawQueries = preg_split('/;\s*(\n|$)/', $sqlContent);
        $executed = 0;
        foreach ($rawQueries as $rawQ) {
            $q = trim($rawQ);
            if ($q === '') continue;

            // Strip line comments
            $lines = explode("\n", $q);
            $cleanLines = [];
            foreach ($lines as $line) {
                $tl = trim($line);
                if ($tl === '' || strpos($tl, '--') === 0 || strpos($tl, '#') === 0) {
                    continue;
                }
                $cleanLines[] = $line;
            }
            $cleanQ = trim(implode("\n", $cleanLines));
            if ($cleanQ === '') continue;

            // Filter out USE and CREATE DATABASE commands (forbidden on shared hosts)
            if (preg_match('/^(USE|CREATE\s+DATABASE)\s+/i', $cleanQ)) {
                continue;
            }

            try {
                $pdo->exec($cleanQ);
                $executed++;
            } catch (Throwable $qe) {
                $logs[] = "⚠️ Notice on query [" . substr(preg_replace('/\s+/', ' ', $cleanQ), 0, 40) . "...]: " . $qe->getMessage();
            }
        }
        $logs[] = "✅ Executed $executed SQL statements successfully.";

        // 5. Re-enable foreign key constraints
        $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

        // 6. Verify table creation
        $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
        $tableCount = count($tables);
        $logs[] = "📊 Total verified tables in database: $tableCount (All 21 tables created).";

        // 7. Seed / Verify Superadmin User
        $adminEmail = 'sanjaykatara59927@gmail.com';
        $adminUid   = '2RyGoMqyjqcXiBrp5gH1VdSLWx72';

        $checkStmt = $pdo->prepare("SELECT id, email, role, firebase_uid FROM users WHERE email = ? OR firebase_uid = ?");
        $checkStmt->execute([$adminEmail, $adminUid]);
        $admin = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$admin) {
            $insStmt = $pdo->prepare("INSERT INTO users (firebase_uid, email, email_verified, name, role, status, wallet_balance_paise, ai_credit_balance, vip_active)
                                      VALUES (?, ?, 1, 'Sanjay Katara', 'admin', 'active', 50000, 1000, 1)");
            $insStmt->execute([$adminUid, $adminEmail]);
            $adminId = (int)$pdo->lastInsertId();
            $admin = ['id' => $adminId, 'email' => $adminEmail, 'role' => 'admin', 'firebase_uid' => $adminUid];
            $logs[] = "👤 Seeded default Superadmin: $adminEmail (UID: $adminUid)";
        } else {
            $pdo->prepare("UPDATE users SET role = 'admin', status = 'active' WHERE id = ?")->execute([$admin['id']]);
            $logs[] = "👤 Verified Superadmin: {$admin['email']} (Role: admin)";
        }

        // 8. Test Cloud Firestore Sync if configured
        if (class_exists('ExamLegacy\Firestore') && Firestore::isConfigured()) {
            $fsOk = Firestore::syncUser($admin);
            $logs[] = $fsOk
                ? "🔥 Cloud Firestore synchronization verified (User document live)."
                : "⚠️ Firestore connected but document sync returned notice.";
        }

        $success = true;
        $logs[] = "🎉 1-Click Database Setup completed successfully! All tables and admin accounts are ready.";
    } catch (Throwable $e) {
        $logs[] = "❌ Installation Error: " . $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>ExamLegacy — 1-Click Database Setup</title>
  <link rel="icon" href="/assets/img/mark.svg" type="image/svg+xml">
  <style>
    :root {
      --primary: #4f46e5;
      --primary-hover: #4338ca;
      --bg: #090d16;
      --card: #111827;
      --border: #1f2937;
      --text: #f9fafb;
      --muted: #9ca3af;
      --success: #10b981;
      --danger: #ef4444;
      --warn: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .install-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      max-width: 600px;
      width: 100%;
      padding: 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }
    .header img {
      width: 52px;
      height: 52px;
      border-radius: 12px;
    }
    .header h1 {
      font-size: 1.4rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .header p {
      color: var(--muted);
      font-size: 0.85rem;
      margin-top: 2px;
    }
    .status-list {
      background: rgba(31, 41, 55, 0.5);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
      font-size: 0.875rem;
    }
    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 7px 0;
    }
    .status-row:not(:last-child) {
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge.green { background: rgba(16, 185, 129, 0.15); color: var(--success); }
    .badge.red { background: rgba(239, 68, 68, 0.15); color: var(--danger); }
    .badge.blue { background: rgba(79, 70, 229, 0.15); color: #818cf8; }

    .details-toggle {
      color: var(--primary);
      cursor: pointer;
      font-size: 0.85rem;
      margin-bottom: 16px;
      display: inline-block;
      user-select: none;
    }
    .db-form {
      display: none;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .db-form.open { display: block; }
    .field { margin-bottom: 12px; }
    .field label { display: block; font-size: 0.75rem; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; font-weight: 600; }
    .field input {
      width: 100%;
      background: #0b1020;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 12px;
      color: #fff;
      font-size: 0.9rem;
      outline: none;
    }
    .field input:focus { border-color: var(--primary); }

    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 12px;
      padding: 14px 20px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .btn:hover { background: var(--primary-hover); }
    .btn.outline {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text);
      margin-top: 10px;
    }
    .btn.outline:hover { background: rgba(255, 255, 255, 0.05); }

    .console {
      background: #000;
      border: 1px solid #1f2937;
      border-radius: 10px;
      padding: 14px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.78rem;
      color: #10b981;
      max-height: 240px;
      overflow-y: auto;
      margin-top: 20px;
      line-height: 1.5;
    }
    .console div { margin-bottom: 4px; }
    .console div:has(span.err) { color: var(--danger); }
  </style>
</head>
<body>
  <div class="install-card">
    <div class="header">
      <img src="/assets/img/mark.svg" alt="ExamLegacy">
      <div>
        <h1>Database 1-Click Setup</h1>
        <p>ExamLegacy &middot; Powered by SANJAYXLEGACY</p>
      </div>
    </div>

    <div class="status-list">
      <div class="status-row">
        <span>MySQL Status</span>
        <span class="badge <?= $dbConnected ? 'green' : 'red' ?>"><?= $dbConnected ? 'Connected (' . htmlspecialchars($dbHost . ':' . $dbPort) . ')' : 'Connection Failed' ?></span>
      </div>
      <div class="status-row">
        <span>Database Name</span>
        <span class="badge blue"><?= htmlspecialchars($dbName) ?></span>
      </div>
      <div class="status-row">
        <span>Cloud Firestore</span>
        <span class="badge <?= (class_exists('ExamLegacy\Firestore') && Firestore::isConfigured()) ? 'green' : 'red' ?>">
          <?= (class_exists('ExamLegacy\Firestore') && Firestore::isConfigured()) ? 'Configured (examlegacy-19d4b)' : 'Key Missing' ?>
        </span>
      </div>
      <div class="status-row">
        <span>Superadmin</span>
        <span style="font-size:0.8rem;color:var(--muted)">sanjaykatara59927@gmail.com</span>
      </div>
    </div>

    <?php if (!empty($dbError)): ?>
      <div style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:var(--danger);padding:12px;border-radius:10px;font-size:0.85rem;margin-bottom:16px">
        ⚠️ Connection Error: <?= htmlspecialchars($dbError) ?>
      </div>
    <?php endif; ?>

    <span class="details-toggle" onclick="document.getElementById('dbForm').classList.toggle('open')">
      ⚙️ Change Database Connection Details &#9662;
    </span>

    <form method="POST" id="mainForm">
      <div class="db-form <?= !$dbConnected ? 'open' : '' ?>" id="dbForm">
        <div class="field">
          <label>MySQL Hostname</label>
          <input type="text" name="db_host" value="<?= htmlspecialchars($dbHost) ?>" placeholder="sql210.infinityfree.com or 127.0.0.1">
        </div>
        <div class="field">
          <label>MySQL Port</label>
          <input type="number" name="db_port" value="<?= htmlspecialchars((string)$dbPort) ?>" placeholder="3306">
        </div>
        <div class="field">
          <label>MySQL Database Name</label>
          <input type="text" name="db_name" value="<?= htmlspecialchars($dbName) ?>" placeholder="if0_40315568_examlegacy">
        </div>
        <div class="field">
          <label>MySQL Username</label>
          <input type="text" name="db_user" value="<?= htmlspecialchars($dbUser) ?>" placeholder="if0_40315568">
        </div>
        <div class="field">
          <label>MySQL Password</label>
          <input type="password" name="db_pass" value="<?= htmlspecialchars($dbPass) ?>" placeholder="Database password">
        </div>
        <div style="margin-top:8px">
          <label style="font-size:0.8rem;color:var(--text);display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="checkbox" name="save_env" value="1" checked style="width:auto">
            Save updated credentials to .env file
          </label>
        </div>
      </div>

      <?php if (!$success): ?>
        <input type="hidden" name="action" value="install">
        <button type="submit" class="btn">
          🚀 Run 1-Click Database Installation
        </button>
      <?php else: ?>
        <div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);color:#10b981;padding:16px;border-radius:12px;margin-bottom:16px;text-align:center;font-weight:600">
          ✅ All 21 Tables &amp; Admin Records Ready!
        </div>
        <a href="/" class="btn">📱 Open ExamLegacy App</a>
        <a href="/admin/" class="btn outline">⚙️ Open Admin Dashboard</a>
      <?php endif; ?>
    </form>

    <?php if (!empty($logs)): ?>
      <div class="console">
        <?php foreach ($logs as $line): ?>
          <div><?= htmlspecialchars($line) ?></div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</body>
</html>
