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

Schedule::command('queue:work --stop-when-empty --tries=3 --max-time=50')
    ->everyMinute()
    ->withoutOverlapping();
