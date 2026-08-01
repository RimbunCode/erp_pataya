<?php

namespace App\Providers;

use App\Services\Core\HaveTransactionsSyncService;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider {
    /**
     * Register any application services.
     */
    public function register(): void {
        $this->app->singleton(HaveTransactionsSyncService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void {
        Vite::prefetch(concurrency: 3);

        // $this->app->extend(EloquentModel::class, \App\Models\Model::class);

        \collect(\glob(base_path('/database/macros/*.php')))->each(function ($file) {
            require $file;
        });
    }
}
