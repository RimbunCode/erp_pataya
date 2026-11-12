<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote')->hourly();

Schedule::command('have-transactions:sync')
    ->timezone('Asia/Jakarta')
    ->dailyAt('01:00')
    ->withoutOverlapping();

Schedule::command('commands:index --rebuild')
    ->timezone('Asia/Jakarta')
    ->dailyAt('01:20')
    ->withoutOverlapping();

Schedule::command('saved-filters:prune')
    ->timezone('Asia/Jakarta')
    ->dailyAt('02:00')
    ->withoutOverlapping();

Schedule::command('todos:remind')
    ->timezone('Asia/Jakarta')
    ->dailyAt('07:00')
    ->withoutOverlapping();

Schedule::command('assets:post-depreciation')
    ->timezone('Asia/Jakarta')
    ->dailyAt('02:30')
    ->withoutOverlapping();

// Requirement H (optimasi dashboard): interval LEBIH PENDEK drpd cache TTL
// (NumberCardService/ChartService::$cacheDuration = 120 detik) supaya ada
// margin aman — job selesai jauh sebelum entri lama expire, cache PRAKTIS
// tidak pernah kosong. Naikkan interval (mis. everyTwoMinutes) kalau jumlah
// Number Card/Chart aktif besar & load background ini mulai terasa.
Schedule::command('dashboard:warm-cache')
    ->timezone('Asia/Jakarta')
    ->everyMinute()
    ->withoutOverlapping();

Schedule::command('queue:work --stop-when-empty --tries=3 --max-time=50')
    ->everyMinute()
    ->withoutOverlapping();

// Finance Fase 1 (Requirement 10.3): rekonsiliasi invarian ledger jurnal harian; kode keluar non-nol + log warning
// bila ada pelanggaran. Jurnal legacy tak seimbang hanya dilaporkan sebagai informasi.
// Q-P1-11 (pemilik produk, 2026-11-04): di Rilis 1 jadwal memakai `--ignore-unjournaled` karena backfill (Task 7.5)
// belum dijalankan. WAJIB dicabut setelah backfill selesai, dan paling lambat di Rilis 2 (NOT NULL, Task 9).
Schedule::command('finance:reconcile-ledger', ['--ignore-unjournaled'])
    ->timezone('Asia/Jakarta')
    ->dailyAt('03:00')
    ->withoutOverlapping();

// Finance Fase 2 (Requirement 11.4; Q-P2-14, disetujui pemilik produk 2026-11-12): bersihkan posting_parity_logs yang
// melewati retensi (config finance.posting.parity_retention_days, default 90 hari).
Schedule::command('finance:prune-parity-logs')
    ->timezone('Asia/Jakarta')
    ->dailyAt('03:30')
    ->withoutOverlapping();
