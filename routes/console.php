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
