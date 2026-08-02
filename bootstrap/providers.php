<?php

use App\Providers\AppServiceProvider;
use App\Providers\EventServiceProvider;
use Clockwork\Support\Laravel\ClockworkServiceProvider;

return [
    AppServiceProvider::class,
    EventServiceProvider::class,
    ClockworkServiceProvider::class,
];
