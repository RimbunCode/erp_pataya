<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote')->hourly();

Schedule::command('have-transactions:sync')
    ->dailyAt('01:00')
    ->withoutOverlapping();

Schedule::command('commands:index --rebuild')
    ->dailyAt('01:20')
    ->withoutOverlapping();

Schedule::command('saved-filters:prune')
    ->dailyAt('02:00')
    ->withoutOverlapping();
