<?php
require_once __DIR__ . '/config.php';

function db(): PDO {
  static $pdo = null;
  if ($pdo) return $pdo;
  $opt = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC];
  if (DB_DRIVER === 'mysql') {
    $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS, $opt);
    $pdo->exec("SET time_zone = '+00:00'");
    $T = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    $ID = 'VARCHAR(64)'; $TS = 'VARCHAR(32)';
    foreach ([
      "CREATE TABLE IF NOT EXISTS users (id $ID PRIMARY KEY, username VARCHAR(64) NOT NULL UNIQUE, pass_hash VARCHAR(255) NOT NULL, created_at $TS NOT NULL) $T",
      "CREATE TABLE IF NOT EXISTS sessions (token_hash VARCHAR(128) PRIMARY KEY, user_id $ID NOT NULL, created_at $TS NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) $T",
      "CREATE TABLE IF NOT EXISTS profiles (id $ID PRIMARY KEY, username VARCHAR(64) NOT NULL, score INT NOT NULL DEFAULT 0, level INT NOT NULL DEFAULT 1, day INT NOT NULL DEFAULT 1, updated_at $TS, FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE) $T",
      "CREATE TABLE IF NOT EXISTS saves (user_id $ID PRIMARY KEY, state LONGTEXT NOT NULL, updated_at $TS, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) $T",
      "CREATE TABLE IF NOT EXISTS weekly_contrib (week VARCHAR(16) NOT NULL, user_id $ID NOT NULL, username VARCHAR(64) NOT NULL, amount INT NOT NULL DEFAULT 0, updated_at $TS, PRIMARY KEY (week, user_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) $T",
      "CREATE TABLE IF NOT EXISTS season_contrib (season VARCHAR(16) NOT NULL, user_id $ID NOT NULL, username VARCHAR(64) NOT NULL, amount INT NOT NULL DEFAULT 0, updated_at $TS, PRIMARY KEY (season, user_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) $T",
      "CREATE TABLE IF NOT EXISTS territories (id VARCHAR(32) PRIMARY KEY, owner $ID NULL, owner_name VARCHAR(64), captured_at $TS, last_attack_at $TS) $T",
      "INSERT IGNORE INTO territories(id) VALUES ('t_mine'),('t_dam'),('t_tower'),('t_depot'),('t_crater')",
      "CREATE TABLE IF NOT EXISTS clans (id $ID PRIMARY KEY, name VARCHAR(64) NOT NULL UNIQUE, created_by $ID, created_at $TS NOT NULL) $T",
      "CREATE TABLE IF NOT EXISTS clan_members (user_id $ID PRIMARY KEY, clan_id $ID NOT NULL, joined_at $TS NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (clan_id) REFERENCES clans(id) ON DELETE CASCADE) $T",
      "CREATE TABLE IF NOT EXISTS clan_stash (clan_id $ID NOT NULL, item VARCHAR(32) NOT NULL, qty INT NOT NULL, PRIMARY KEY (clan_id, item), FOREIGN KEY (clan_id) REFERENCES clans(id) ON DELETE CASCADE) $T",
      "CREATE TABLE IF NOT EXISTS player_quests (id $ID PRIMARY KEY, poster_id $ID NOT NULL, title VARCHAR(255) NOT NULL, want_item VARCHAR(32) NOT NULL, want_qty INT NOT NULL, reward_item VARCHAR(32) NOT NULL, reward_qty INT NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'open', helper_id $ID NULL, poster_claimed TINYINT NOT NULL DEFAULT 0, created_at $TS NOT NULL, FOREIGN KEY (poster_id) REFERENCES users(id) ON DELETE CASCADE) $T",
      "CREATE TABLE IF NOT EXISTS market_offers (id $ID PRIMARY KEY, seller_id $ID NOT NULL, buyer_id $ID NULL, give_item VARCHAR(32) NOT NULL, give_qty INT NOT NULL, want_item VARCHAR(32) NOT NULL, want_qty INT NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'open', seller_claimed TINYINT NOT NULL DEFAULT 0, created_at $TS NOT NULL, FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE) $T",
      "CREATE TABLE IF NOT EXISTS chat_messages (id INT AUTO_INCREMENT PRIMARY KEY, clan_id $ID NULL, user_id $ID NOT NULL, username VARCHAR(64) NOT NULL, body TEXT NOT NULL, created_at $TS NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) $T",
      "CREATE TABLE IF NOT EXISTS gifts (id $ID PRIMARY KEY, from_id $ID NOT NULL, from_name VARCHAR(64) NOT NULL, to_id $ID NOT NULL, item VARCHAR(32) NOT NULL, qty INT NOT NULL, claimed TINYINT NOT NULL DEFAULT 0, created_at $TS NOT NULL) $T",
      "CREATE TABLE IF NOT EXISTS clan_wars (id $ID PRIMARY KEY, attacker $ID NOT NULL, defender $ID NOT NULL, attacker_name VARCHAR(64) NOT NULL, defender_name VARCHAR(64) NOT NULL, won TINYINT NOT NULL, loot TEXT NOT NULL, created_at $TS NOT NULL) $T",
    ] as $q) $pdo->exec($q);
    return $pdo;
  }
  $dir = dirname(DB_PATH);
  if (!is_dir($dir)) @mkdir($dir, 0770, true);
  $pdo = new PDO('sqlite:' . DB_PATH, null, null, $opt);
  $pdo->exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  $pdo->exec(<<<SQL
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, pass_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, username TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0, level INTEGER NOT NULL DEFAULT 1, day INTEGER NOT NULL DEFAULT 1, updated_at TEXT);
CREATE TABLE IF NOT EXISTS saves (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, state TEXT NOT NULL, updated_at TEXT);
CREATE TABLE IF NOT EXISTS weekly_contrib (week TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, username TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0, updated_at TEXT, PRIMARY KEY (week, user_id));
CREATE TABLE IF NOT EXISTS season_contrib (season TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, username TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0, updated_at TEXT, PRIMARY KEY (season, user_id));
CREATE TABLE IF NOT EXISTS territories (id TEXT PRIMARY KEY, owner TEXT, owner_name TEXT, captured_at TEXT, last_attack_at TEXT);
INSERT OR IGNORE INTO territories(id) VALUES ('t_mine'),('t_dam'),('t_tower'),('t_depot'),('t_crater');
CREATE TABLE IF NOT EXISTS clans (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, created_by TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS clan_members (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, clan_id TEXT NOT NULL REFERENCES clans(id) ON DELETE CASCADE, joined_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS clan_stash (clan_id TEXT NOT NULL REFERENCES clans(id) ON DELETE CASCADE, item TEXT NOT NULL, qty INTEGER NOT NULL, PRIMARY KEY (clan_id, item));
CREATE TABLE IF NOT EXISTS player_quests (id TEXT PRIMARY KEY, poster_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, want_item TEXT NOT NULL, want_qty INTEGER NOT NULL, reward_item TEXT NOT NULL, reward_qty INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open', helper_id TEXT, poster_claimed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS market_offers (id TEXT PRIMARY KEY, seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, buyer_id TEXT, give_item TEXT NOT NULL, give_qty INTEGER NOT NULL, want_item TEXT NOT NULL, want_qty INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open', seller_claimed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, clan_id TEXT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, username TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS gifts (id TEXT PRIMARY KEY, from_id TEXT NOT NULL, from_name TEXT NOT NULL, to_id TEXT NOT NULL, item TEXT NOT NULL, qty INTEGER NOT NULL, claimed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS clan_wars (id TEXT PRIMARY KEY, attacker TEXT NOT NULL, defender TEXT NOT NULL, attacker_name TEXT NOT NULL, defender_name TEXT NOT NULL, won INTEGER NOT NULL, loot TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
SQL);
  return $pdo;
}

function now(): string { return gmdate('Y-m-d\TH:i:s\Z'); }
function new_id(): string { $b = random_bytes(16); $b[6] = chr((ord($b[6]) & 0x0f) | 0x40); $b[8] = chr((ord($b[8]) & 0x3f) | 0x80); return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4)); }

// ---------- per-player save files: data/saves/<username>.json ----------
function save_file(string $uid): string {
  $dir = dirname(DB_PATH) . '/saves';
  if (!is_dir($dir)) @mkdir($dir, 0770, true);
  $st = db()->prepare('SELECT username FROM users WHERE id=?'); $st->execute([$uid]);
  $name = strtolower((string)$st->fetchColumn());
  if (!preg_match('/^[a-z0-9_-]{1,40}$/', $name)) $name = $uid;
  return "$dir/$name.json";
}
function save_read(string $uid): ?array {
  if (DB_DRIVER === 'mysql') {
    $st = db()->prepare('SELECT state, updated_at FROM saves WHERE user_id=?'); $st->execute([$uid]);
    if ($r = $st->fetch()) return ['user_id' => $uid, 'state' => json_decode($r['state'], true), 'updated_at' => $r['updated_at']];
    // One-time move of an older per-player file into MySQL.
    $f = save_file($uid);
    if (is_file($f)) { $d = json_decode((string)file_get_contents($f), true); if (is_array($d) && isset($d['state'])) { save_write($uid, $d['state']); @rename($f, $f . '.imported'); return $d; } }
    return null;
  }
  $f = save_file($uid);
  if (is_file($f)) { $d = json_decode((string)file_get_contents($f), true); return is_array($d) ? $d : null; }
  // One-time move of an older database save into its own file.
  $st = db()->prepare('SELECT state, updated_at FROM saves WHERE user_id=?'); $st->execute([$uid]);
  $r = $st->fetch(); if (!$r) return null;
  $d = ['user_id' => $uid, 'state' => json_decode($r['state'], true), 'updated_at' => $r['updated_at']];
  save_write($uid, $d['state']);
  return $d;
}
function save_write(string $uid, $state): void {
  $json = json_encode(['user_id' => $uid, 'state' => $state, 'updated_at' => now()], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  if (strlen($json) > 3000000) throw new Exception('Salvestus liiga suur');
  if (DB_DRIVER === 'mysql') {
    $st = json_encode($state, JSON_UNESCAPED_UNICODE); $t = now();
    $u = db()->prepare('UPDATE saves SET state=?, updated_at=? WHERE user_id=?'); $u->execute([$st, $t, $uid]);
    if ($u->rowCount() === 0) db()->prepare('INSERT IGNORE INTO saves(user_id, state, updated_at) VALUES (?,?,?)')->execute([$uid, $st, $t]);
    return;
  }
  $f = save_file($uid); $tmp = $f . '.tmp';
  file_put_contents($tmp, $json, LOCK_EX); rename($tmp, $f);
}
function save_delete(string $uid): void { if (DB_DRIVER === 'mysql') db()->prepare('DELETE FROM saves WHERE user_id=?')->execute([$uid]); $f = save_file($uid); if (is_file($f)) @unlink($f); }
