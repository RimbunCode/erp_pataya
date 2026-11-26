<?php

namespace App\Providers;

use App\Services\Core\HaveTransactionsSyncService;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Posting\PostedAccountRecorderRegistry;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider {
    /**
     * Register any application services.
     */
    public function register(): void {
        $this->app->singleton(HaveTransactionsSyncService::class);
        // Scoped: the per-request memo in SettingsService (Requirement 3.1)
        // only works when every resolve within one request/job shares it.
        $this->app->scoped(SettingsService::class);
        // Harus didaftarkan eksplisit: untuk parameter class opsional yang belum terdaftar, container memakai default
        // null, sehingga `PostingService` tidak menerima registry write-back (Finance Fase 2, Task 12.1).
        $this->app->singleton(PostedAccountRecorderRegistry::class);
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
