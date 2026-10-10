<?php
// TUHK admin: reset a player's password, delete an account, or restore a save backup. Protected by ADMIN_PASSWORD in api/config.php.
require_once __DIR__ . '/api/db.php';
$msg = ''; $backups = null; $who = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  if (ADMIN_PASSWORD === 'muuda-mind') $msg = 'Muuda enne ADMIN_PASSWORD failis api/config.php.';
  elseif (!hash_equals(ADMIN_PASSWORD, (string)($_POST['admin'] ?? ''))) { usleep(1000000); $msg = 'Vale admini parool.'; }
  else {
    $st = db()->prepare('SELECT id FROM users WHERE username=?'); $st->execute([trim((string)($_POST['user'] ?? ''))]);
    $id = $st->fetchColumn();
    if (!$id) $msg = 'Sellist kasutajat pole.';
    elseif (($_POST['do'] ?? '') === 'backups') { $backups = list_backups($id); $who = trim((string)$_POST['user']); $msg = $backups ? 'Varukoopiad (uusimad ees):' : 'Sellel mängijal pole veel varukoopiaid.'; }
    elseif (($_POST['do'] ?? '') === 'restore') {
      $file = basename((string)($_POST['file'] ?? ''));
      $path = backup_dir() . '/' . $file;
      $d = (str_starts_with($file, backup_name($id) . '-') && is_file($path)) ? json_decode((string)file_get_contents($path), true) : null;
      if (!is_array($d['state'] ?? null)) $msg = 'Varukoopiat ei leitud.';
      else {
        $cur = save_current($id); $st = $d['state'];
        $st['rev'] = (int)($cur['rev'] ?? 0) + 1; // open game windows see a newer save and reload it
        save_write($id, $st);
        $msg = 'Taastatud: ' . $file . ' (' . save_buildings($st) . ' hoonetaset). Mängija peab lehe uuesti laadima.';
      }
    }
    elseif (($_POST['do'] ?? '') === 'delete') { save_delete($id); db()->prepare('DELETE FROM users WHERE id=?')->execute([$id]); $msg = 'Konto kustutatud.'; }
    elseif (strlen((string)($_POST['pw'] ?? '')) < 6) $msg = 'Uus parool peab olema vähemalt 6 märki.';
    else {
      db()->prepare('UPDATE users SET pass_hash=? WHERE id=?')->execute([password_hash($_POST['pw'], PASSWORD_DEFAULT), $id]);
      db()->prepare('DELETE FROM sessions WHERE user_id=?')->execute([$id]);
      $msg = 'Parool muudetud.';
    }
  }
}
$count = (int)db()->query('SELECT COUNT(*) FROM users')->fetchColumn();
?><!doctype html><html lang="et"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TUHK admin</title>
<style>body{font-family:monospace;background:#14110f;color:#e8dcc8;max-width:420px;margin:40px auto;padding:0 16px}input,select,button{display:block;width:100%;margin:6px 0;padding:8px;background:#221d19;color:inherit;border:1px solid #6b5a45}button{background:#c46a2b;color:#14110f;font-weight:bold;cursor:pointer}.m{color:#f0b35a}</style></head>
<body><h1>TUHK admin</h1><p>Mängijaid: <?= $count ?></p><?php if ($msg): ?><p class="m"><?= htmlspecialchars($msg) ?></p><?php endif; ?>
<form method="post"><input name="admin" type="password" placeholder="Admini parool" required><input name="user" placeholder="Mängija kasutajanimi" required>
<input name="pw" type="password" placeholder="Uus parool (lähtestamiseks)"><select name="do"><option value="reset">Lähtesta parool</option><option value="backups">Näita salvestuse varukoopiaid</option><option value="delete">Kustuta konto</option></select><button>Tee ära</button></form>
<?php if ($backups): ?><form method="post"><input type="hidden" name="do" value="restore"><input type="hidden" name="user" value="<?= htmlspecialchars($who) ?>"><input name="admin" type="password" placeholder="Admini parool" required>
<select name="file"><?php foreach ($backups as $b): ?><option value="<?= htmlspecialchars($b['file']) ?>"><?= htmlspecialchars($b['time'] . ' UTC · ' . $b['buildings'] . ' hoonetaset · ' . $b['file']) ?></option><?php endforeach; ?></select>
<button>Taasta valitud varukoopia</button></form><?php endif; ?></body></html>
