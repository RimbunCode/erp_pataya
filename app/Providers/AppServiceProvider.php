<?php

namespace App\Providers;

use App\Enums\PostingDocumentType;
use App\Models\Asset\AssetValueAdjustment;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\StockEntry;
use App\Models\Purchase\PurchaseReceipt;
use App\Services\Asset\Accounting\AssetValueAdjustmentPanelSource;
use App\Services\Core\HaveTransactionsSyncService;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Accounting\PaymentEntryPanelSource;
use App\Services\Finances\Accounting\PurchaseInvoicePanelSource;
use App\Services\Finances\Posting\AccountPanel\PanelSourceRegistry;
use App\Services\Finances\Posting\PostedAccountRecorderRegistry;
use App\Services\Finances\Tax\TaxRuleResolver;
use App\Services\Inventory\Accounting\DeliveryNotePanelSource;
use App\Services\Inventory\Accounting\StockEntryPanelSource;
use App\Services\Purchase\Accounting\PurchaseReceiptPanelSource;
use App\Services\Sales\Accounting\SalesInvoicePanelSource;
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
        // Scoped: cache (tax, tanggal) Tax Engine berlaku satu request/job (Finance Fase 3, Requirement 3.3).
        $this->app->scoped(TaxRuleResolver::class);
        // Harus didaftarkan eksplisit: untuk parameter class opsional yang belum terdaftar, container memakai default
        // null, sehingga `PostingService` tidak menerima registry write-back (Finance Fase 2, Task 12.1).
        $this->app->singleton(PostedAccountRecorderRegistry::class);
        // Peta model dokumen => sumber panel "Akun pencatatan" (Task 12.4). Didaftarkan di sini, bukan di namespace
        // Posting, agar Posting tidak mengimpor model modul bisnis (P-8).
        $this->app->singleton(PanelSourceRegistry::class, function ($app) {
            $registry = new PanelSourceRegistry($app);
            $registry->register(SalesInvoice::class, PostingDocumentType::SalesInvoice, SalesInvoicePanelSource::class);
            $registry->register(PurchaseInvoice::class, PostingDocumentType::PurchaseInvoice, PurchaseInvoicePanelSource::class);
            $registry->register(PaymentEntry::class, PostingDocumentType::PaymentEntry, PaymentEntryPanelSource::class);
            $registry->register(StockEntry::class, PostingDocumentType::StockEntry, StockEntryPanelSource::class);
            $registry->register(AssetValueAdjustment::class, PostingDocumentType::AssetValueAdjustment, AssetValueAdjustmentPanelSource::class);
            $registry->register(DeliveryNote::class, PostingDocumentType::DeliveryNote, DeliveryNotePanelSource::class);
            $registry->register(PurchaseReceipt::class, PostingDocumentType::PurchaseReceipt, PurchaseReceiptPanelSource::class);

            return $registry;
        });
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
