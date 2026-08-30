<?php

namespace Tests\Unit\Models;

use App\Contracts\SubmitableService;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetMovement;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetValueAdjustment;
use App\Models\Asset\Maintenance\AssetMaintenance;
use App\Models\Asset\Maintenance\AssetMaintenanceTeam;
use App\Models\CRM\Quotation;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\StockEntry;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Sales\InternalOrder;
use App\Models\Sales\SalesOrder;
use App\Models\Service\WorkOrder;
use App\Traits\Submitable;
use PHPUnit\Framework\Attributes\DataProvider;
use ReflectionClass;
use Tests\TestCase;

/**
 * Regresi untuk bug: model yang mendeklarasikan
 * `public static string $service = App\Services\...\XService::class` TANPA
 * `use` import yang cocok membuat PHP me-resolve nama itu relatif ke namespace
 * model, menghasilkan FQCN ngawur (mis.
 * App\Models\Inventory\App\Services\Inventory\StockEntryService).
 *
 * `::class` cuma string-concat saat compile — tidak memvalidasi eksistensi —
 * jadi bug diam sampai string dipakai runtime. Untuk StockEntry meledak di
 * Submitable::checkApproval() lewat
 * `is_subclass_of(static::$service, SubmitableService::class)` yang jadi false
 * -> LogicException "... harus implement App\Contracts\SubmitableService".
 *
 * Test murni refleksi, tanpa DB.
 *
 * Daftar model di-hardcode (bukan scan filesystem) karena data provider jalan
 * sebelum container Laravel boot — app_path()/config() belum tersedia. Kalau
 * ada model baru dengan property $service, tambahkan ke SERVICE_MODELS. Kalau
 * ada model Submitable baru, tambahkan ke SUBMITABLE_MODELS.
 */
class SubmitableServicePropertyTest extends TestCase {
    /**
     * Semua model dengan property statis $service (Submitable maupun bukan —
     * mis. AssetMaintenance pakai $service untuk CrudService, bukan approval).
     *
     * @var list<class-string>
     */
    private const SERVICE_MODELS = [
        Asset::class,
        AssetMovement::class,
        AssetService::class,
        AssetValueAdjustment::class,
        AssetMaintenance::class,
        AssetMaintenanceTeam::class,
        Quotation::class,
        PaymentEntry::class,
        PurchaseInvoice::class,
        SalesInvoice::class,
        DeliveryNote::class,
        StockEntry::class,
        PurchaseOrder::class,
        PurchaseReceipt::class,
        PurchaseRequest::class,
        InternalOrder::class,
        SalesOrder::class,
        WorkOrder::class,
    ];

    /**
     * Subset yang memakai trait Submitable — $service-nya WAJIB implement
     * SubmitableService karena dipanggil di checkApproval().
     *
     * @var list<class-string>
     */
    private const SUBMITABLE_MODELS = [
        Quotation::class,
        PaymentEntry::class,
        PurchaseInvoice::class,
        SalesInvoice::class,
        DeliveryNote::class,
        StockEntry::class,
        PurchaseOrder::class,
        PurchaseReceipt::class,
        PurchaseRequest::class,
        InternalOrder::class,
        SalesOrder::class,
        WorkOrder::class,
        Asset::class,
        AssetMovement::class,
        AssetService::class,
        AssetValueAdjustment::class,
    ];

    /**
     * @return array<string, array{class-string}>
     */
    public static function serviceModelProvider(): array {
        return collect(self::SERVICE_MODELS)
            ->mapWithKeys(fn (string $class) => [class_basename($class) => [$class]])
            ->all();
    }

    /**
     * @return array<string, array{class-string}>
     */
    public static function submitableModelProvider(): array {
        return collect(self::SUBMITABLE_MODELS)
            ->mapWithKeys(fn (string $class) => [class_basename($class) => [$class]])
            ->all();
    }

    /**
     * FQCN di property $service harus menunjuk kelas yang benar-benar ada —
     * bukan hasil resolusi relatif yang ngawur karena `use` import kurang.
     *
     * @param  class-string  $modelClass
     */
    #[DataProvider('serviceModelProvider')]
    public function test_service_property_resolves_to_real_class(string $modelClass): void {
        $this->assertTrue(
            property_exists($modelClass, 'service'),
            "{$modelClass} tidak lagi punya property \$service — hapus dari SERVICE_MODELS.",
        );

        $service = (new ReflectionClass($modelClass))->getStaticPropertyValue('service');

        $this->assertIsString($service);

        $this->assertTrue(
            class_exists($service),
            "{$modelClass}::\$service menunjuk kelas yang tidak ada: {$service} "
            . '(kemungkinan FQCN ngawur karena kurang `use` import).',
        );
    }

    /**
     * Model Submitable: $service wajib implement SubmitableService — kalau
     * tidak, Submitable::checkApproval() melempar LogicException.
     *
     * @param  class-string  $modelClass
     */
    #[DataProvider('submitableModelProvider')]
    public function test_submitable_service_implements_contract(string $modelClass): void {
        $this->assertContains(
            Submitable::class,
            class_uses_recursive($modelClass),
            "{$modelClass} tidak lagi memakai trait Submitable — hapus dari SUBMITABLE_MODELS.",
        );

        $this->assertTrue(
            property_exists($modelClass, 'service'),
            "{$modelClass} memakai trait Submitable tapi tidak mendeklarasikan property \$service.",
        );

        $service = (new ReflectionClass($modelClass))->getStaticPropertyValue('service');

        $this->assertIsString($service);

        $this->assertTrue(
            is_subclass_of($service, SubmitableService::class),
            "{$service} (dari {$modelClass}::\$service) harus implement " . SubmitableService::class . '.',
        );
    }
}
