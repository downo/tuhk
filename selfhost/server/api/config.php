<?php
// TUHK server settings. CHANGE ADMIN_PASSWORD before going live.
const ADMIN_PASSWORD = 'muuda-mind';
// Andmebaas: 'mysql' (soovitatud) või 'sqlite'.
const DB_DRIVER = 'mysql';
const DB_HOST = 'localhost';
const DB_NAME = 'plextoni_tuhk';
const DB_USER = 'plextoni_tuhk';
const DB_PASS = 'Cqqxpeyd2k7XW8FBneea';
// SQLite fail (ainult kui DB_DRIVER = 'sqlite'). Vanad salvestusfailid loetakse siit kaustast ja tõstetakse MySQL-i.
const DB_PATH = __DIR__ . '/data/tuhk.sqlite';
