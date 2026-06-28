<?php

use App\Http\Controllers\Api\DeployWebhookController;
use Illuminate\Support\Facades\Route;

Route::post('/webhooks/deploy', DeployWebhookController::class)
    ->name('webhooks.deploy')
    ->middleware('throttle:10,1');
