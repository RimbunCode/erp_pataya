<?php

namespace App\Services\Migration\Migrators\User\Roles;

use App\Models\Core\Currency;
use App\Models\Core\EmailTemplate;
use App\Models\Core\Preference;
use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentMethod;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\PaymentTermTemplate;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\Tax;
use App\Models\Inventory\Attribute;
use App\Models\Inventory\Category;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemAlternative;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Purchase\Supplier;
use App\Models\Sales\Customer;
use App\Models\Sales\InternalOrder;
use App\Models\Sales\SalesOrder;
use App\Models\Service\WorkOrder;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Models\User\User;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RolePermissionMigrator extends BaseMigrator {
    /**
     * Nama tabel sumber di database legacy.
     */
    protected string $sourceTable = 'permission_role';

    /**
     * Model tujuan untuk pencatatan Log.
     */
    protected string $targetModel = RolePermission::class;

    /**
     * Peta nama permission legacy -> daftar model Eloquent ERP yang dituju.
     * Satu permission legacy bisa memetakan ke lebih dari satu model (relasi 1:many),
     * dan beberapa model bisa dituju oleh lebih dari satu permission legacy (many:1).
     * Permission legacy yang tidak punya padanan sumber daya di ERP baru sengaja
     * tidak dicantumkan di sini (lihat resolveTargetModels() untuk penanganannya).
     *
     * @var array<string, array<int, class-string>>
     */
    protected array $permissionModelMap = [
        // Customer
        'manage_customer' => [Customer::class],
        'add_customer'    => [Customer::class],
        'edit_customer'   => [Customer::class],
        'delete_customer' => [Customer::class],

        // Item
        'manage_item'     => [Item::class],
        'add_item'        => [Item::class],
        'edit_item'       => [Item::class],
        'delete_item'     => [Item::class],
        'edit_item_price' => [Item::class],

        // Item Category
        'manage_item_category' => [Category::class],
        'add_item_category'    => [Category::class],
        'edit_item_category'   => [Category::class],
        'delete_item_category' => [Category::class],

        // Supplier
        'manage_supplier' => [Supplier::class],
        'add_supplier'    => [Supplier::class],
        'edit_supplier'   => [Supplier::class],
        'delete_supplier' => [Supplier::class],

        // Order (sales)
        'manage_order' => [SalesOrder::class],
        'add_order'    => [SalesOrder::class],
        'edit_order'   => [SalesOrder::class],
        'delete_order' => [SalesOrder::class],
        'manage_sale'  => [SalesOrder::class],

        // Purchase (order)
        'manage_purchase' => [PurchaseOrder::class],
        'add_purchase'    => [PurchaseOrder::class],
        'edit_purchase'   => [PurchaseOrder::class],
        'delete_purchase' => [PurchaseOrder::class],

        // Purchase Request / Item Request
        'add_purchase_request' => [PurchaseRequest::class],
        'add_item_request'     => [PurchaseRequest::class],
        'edit_item_request'    => [PurchaseRequest::class],
        'delete_item_request'  => [PurchaseRequest::class],
        'manage_item_request'  => [PurchaseRequest::class],

        // Sales Invoice
        'manage_invoice' => [SalesInvoice::class],
        'add_invoice'    => [SalesInvoice::class],
        'edit_invoice'   => [SalesInvoice::class],
        'delete_invoice' => [SalesInvoice::class],

        // Payment (customer & supplier)
        'manage_payment'          => [PaymentEntry::class],
        'add_payment'             => [PaymentEntry::class],
        'edit_payment'            => [PaymentEntry::class],
        'delete_payment'          => [PaymentEntry::class],
        'manage_purchase_payment' => [PaymentEntry::class],
        'add_purchase_payment'    => [PaymentEntry::class],
        'edit_purchase_payment'   => [PaymentEntry::class],
        'delete_purchase_payment' => [PaymentEntry::class],

        // Payment Method
        'manage_payment_method' => [PaymentMethod::class],
        'add_payment_method'    => [PaymentMethod::class],
        'edit_payment_method'   => [PaymentMethod::class],
        'delete_payment_method' => [PaymentMethod::class],

        // Payment Term
        'manage_payment_term' => [PaymentTermTemplate::class],
        'add_payment_term'    => [PaymentTermTemplate::class],
        'edit_payment_term'   => [PaymentTermTemplate::class],
        'delete_payment_term' => [PaymentTermTemplate::class],

        // Role
        'manage_role' => [Role::class],
        'add_role'    => [Role::class],
        'edit_role'   => [Role::class],
        'delete_role' => [Role::class],

        // Tax
        'manage_tax' => [Tax::class],
        'add_tax'    => [Tax::class],
        'edit_tax'   => [Tax::class],
        'delete_tax' => [Tax::class],

        // Currency
        'manage_currency' => [Currency::class],
        'add_currency'    => [Currency::class],
        'edit_currency'   => [Currency::class],
        'delete_currency' => [Currency::class],

        // Unit
        'manage_unit' => [Unit::class],
        'add_unit'    => [Unit::class],
        'edit_unit'   => [Unit::class],
        'delete_unit' => [Unit::class],

        // Location -> Warehouse
        'manage_location' => [Warehouse::class],
        'add_location'    => [Warehouse::class],
        'edit_location'   => [Warehouse::class],
        'delete_location' => [Warehouse::class],

        // Shipment (kirim ke customer) -> DeliveryNote
        'shipment'             => [DeliveryNote::class],
        'manage_shipment'      => [DeliveryNote::class],
        'add_shipment'         => [DeliveryNote::class],
        'edit_shipment'        => [DeliveryNote::class],
        'delete_shipment'      => [DeliveryNote::class],
        'view_shipment_status' => [DeliveryNote::class],

        // Shipment receive (terima dari vendor) -> PurchaseReceipt
        'shipment_receive_service'   => [PurchaseReceipt::class],
        'shipment_receive_sparepart' => [PurchaseReceipt::class],
        'shipment_receive_vehicle'   => [PurchaseReceipt::class],

        // Transfer -> StockEntry
        'manage_transfer' => [StockEntry::class],
        'add_transfer'    => [StockEntry::class],
        'edit_transfer'   => [StockEntry::class],
        'delete_transfer' => [StockEntry::class],

        // Internal Order
        'manage_internal_order' => [InternalOrder::class],

        // Work Order / Service
        'add_work_order'        => [WorkOrder::class],
        'monitoring_work_order' => [WorkOrder::class],
        'add_breakdown'         => [WorkOrder::class],
        'manage_service'        => [WorkOrder::class],
        'add_service'           => [WorkOrder::class],
        'edit_service'          => [WorkOrder::class],
        'delete_service'        => [WorkOrder::class],

        // Team Member -> User
        'manage_team_member' => [User::class],
        'add_team_member'    => [User::class],
        'edit_team_member'   => [User::class],
        'delete_team_member' => [User::class],

        // Email Template
        'manage_email_setup'                   => [EmailTemplate::class],
        'manage_email_template'                => [EmailTemplate::class],
        'manage_invoice_email_template'        => [EmailTemplate::class],
        'manage_order_email_template'          => [EmailTemplate::class],
        'manage_packing_email_template'        => [EmailTemplate::class],
        'manage_payment_email_template'        => [EmailTemplate::class],
        'manage_purchase_order_email_template' => [EmailTemplate::class],
        'manage_shipment_email_template'       => [EmailTemplate::class],

        // Setting / Preference
        'manage_general_setting' => [Preference::class],
        'manage_company_setting' => [Preference::class],
        'manage_preference'      => [Preference::class],
        'manage_setting'         => [Preference::class],

        // Income/Expense Category -> Account
        'manage_income_expense_category' => [Account::class],
        'add_income_expense_category'    => [Account::class],
        'edit_income_expense_category'   => [Account::class],
        'delete_income_expense_category' => [Account::class],

        // Finance module-wide
        'manage_finance' => [
            Account::class,
            GeneralLedger::class,
            PaymentEntry::class,
            PaymentMethod::class,
            PaymentSchedule::class,
            PaymentTermTemplate::class,
            PurchaseInvoice::class,
            SalesInvoice::class,
            Tax::class,
        ],

        // Stock On Hand -> seluruh module Inventory + PurchaseReceipt
        'manage_stock_on_hand' => [
            Attribute::class,
            Category::class,
            DeliveryNote::class,
            Item::class,
            ItemAlternative::class,
            ItemVariant::class,
            StockEntry::class,
            StockLedgerEntry::class,
            Unit::class,
            Warehouse::class,
            PurchaseReceipt::class,
        ],

        // Barcode -> Item + ItemVariant
        'manage_barcode' => [Item::class, ItemVariant::class],
    ];

    /**
     * Permission legacy yang sengaja tidak dipetakan (tidak ada padanan sumber daya
     * di ERP baru). Dicatat eksplisit supaya migrator tidak diam-diam melewatkannya
     * tanpa jejak, dan supaya perbedaan dengan "lupa dipetakan" jelas terlihat.
     *
     * @var array<int, string>
     */
    protected array $intentionallySkipped = [
        'do_approval',
        'do_payment_approval',
        'manage_report',
        'manage_purchase_report',
        'manage_sale_report',
        'manage_sale_history_report',
        'manage_team_report',
        'report_sparepart',
        'manage_db_backup',
        'add_db_backup',
        'delete_db_backup',
        'download_db_backup',
        'manage_payment_gateway',
        'add_sales_type',
        'edit_sales_type',
        'delete_sales_type',
        'manage_sales_type',
    ];

    /**
     * Permission legacy yang ditujukan ke SEMUA model (lintas module) dengan
     * flag terbatas (select+read saja), bukan mengikuti aturan prefix biasa.
     *
     * @var array<int, string>
     */
    protected array $crossModuleReadOnlyPermissions = [
        'access_audit',
    ];

    /**
     * Execute the migration logic.
     */
    public function migrate(): void {
        $this->log("Memulai migrasi untuk tabel: {$this->sourceTable}");

        $legacyPermissionNames = DB::connection($this->sourceConnection)
            ->table('permissions')
            ->pluck('name', 'id');

        $erpPermissionsByModel = DB::table('permissions')
            ->get(['id', 'model', 'permissions', 'is_submitable'])
            ->keyBy('model');

        $allErpPermissions = $erpPermissionsByModel->values();

        // Akumulasi flag per (role_id, permission_id) sebelum ditulis ke DB, supaya
        // beberapa permission legacy yang menyasar model ERP yang sama (mis. manage_finance
        // dan manage_payment_method sama-sama menyentuh PaymentMethod) digabung dengan OR,
        // bukan saling menimpa.
        $accumulated     = [];
        $skippedUnmapped = [];

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy('role_id')
            ->orderBy('permission_id')
            ->chunk(500, function ($records) use ($legacyPermissionNames, $erpPermissionsByModel, $allErpPermissions, &$accumulated, &$skippedUnmapped) {
                foreach ($records as $record) {
                    $roleUlid = $this->getNewId('roles', $record->role_id);
                    if ($roleUlid === null) {
                        continue;
                    }

                    $legacyName = $legacyPermissionNames[$record->permission_id] ?? null;
                    if ($legacyName === null) {
                        continue;
                    }

                    if (in_array($legacyName, $this->intentionallySkipped, true)) {
                        continue;
                    }

                    $targetErpPermissions = $this->resolveTargetErpPermissions(
                        $legacyName,
                        $erpPermissionsByModel,
                        $allErpPermissions,
                    );

                    if ($targetErpPermissions === []) {
                        $skippedUnmapped[$legacyName] = true;

                        continue;
                    }

                    foreach ($targetErpPermissions as $erpPermission) {
                        $flags = $this->resolveFlags($legacyName, $erpPermission);
                        $key   = $roleUlid . '|' . $erpPermission->id;

                        if (! isset($accumulated[$key])) {
                            $accumulated[$key] = [
                                'role_id'       => $roleUlid,
                                'permission_id' => $erpPermission->id,
                                'module'        => $erpPermission->module ?? null,
                                'name'          => $erpPermission->name ?? null,
                                'model'         => $erpPermission->model,
                                'is_submitable' => (bool) $erpPermission->is_submitable,
                                'permissions'   => [],
                            ];
                        }

                        foreach ($flags as $flag) {
                            $accumulated[$key]['permissions'][$flag] = true;
                        }
                    }
                }

                $this->log('Berhasil memproses ' . count($records) . ' baris...');
            });

        foreach ($accumulated as $row) {
            $newUlid = (string) Str::ulid();

            $mappedData = [
                'permission_id' => $row['permission_id'],
                'module'        => $row['module'],
                'name'          => $row['name'],
                'model'         => $row['model'],
                'role_id'       => $row['role_id'],
                'level'         => 0,
                'only_creator'  => false,
                'is_submitable' => $row['is_submitable'],
                'permissions'   => json_encode($row['permissions']),
                'created_at'    => now(),
                'updated_at'    => now(),
            ];

            DB::table('role_permissions')->updateOrInsert([
                'role_id'       => $row['role_id'],
                'permission_id' => $row['permission_id'],
                'level'         => 0,
                'only_creator'  => false,
            ], $mappedData + ['id' => $newUlid]);

            $this->recordModelLog($this->targetModel, $newUlid, $mappedData);
        }

        if ($skippedUnmapped !== []) {
            $this->log('Permission legacy tanpa target ERP (tidak dipetakan): ' . implode(', ', array_keys($skippedUnmapped)), 'warning');
        }

        $this->log("Migrasi {$this->sourceTable} selesai sepenuhnya.");
    }

    /**
     * Resolve daftar row Permission ERP (dari tabel `permissions`) yang dituju
     * oleh satu nama permission legacy.
     *
     * @return array<int, object>
     */
    protected function resolveTargetErpPermissions(string $legacyName, Collection $erpPermissionsByModel, Collection $allErpPermissions): array {
        if (in_array($legacyName, $this->crossModuleReadOnlyPermissions, true)) {
            return $allErpPermissions->all();
        }

        $modelClasses = $this->permissionModelMap[$legacyName] ?? null;
        if ($modelClasses === null) {
            return [];
        }

        $resolved = [];
        foreach ($modelClasses as $modelClass) {
            $erpPermission = $erpPermissionsByModel[$modelClass] ?? null;
            if ($erpPermission !== null) {
                $resolved[] = $erpPermission;
            }
        }

        return $resolved;
    }

    /**
     * Resolve flag JSON `permissions` yang bernilai true untuk satu permission legacy,
     * dibatasi hanya pada flag yang valid untuk Permission ERP tujuan.
     *
     * @return array<int, string>
     */
    protected function resolveFlags(string $legacyName, object $erpPermission): array {
        $validKeys = is_array($erpPermission->permissions)
            ? $erpPermission->permissions
            : (json_decode((string) $erpPermission->permissions, true) ?? []);

        if (in_array($legacyName, $this->crossModuleReadOnlyPermissions, true)) {
            return array_values(array_intersect(['select', 'read'], $validKeys));
        }

        $flags = match (true) {
            str_starts_with($legacyName, 'add_')    => ['select', 'read', 'create'],
            str_starts_with($legacyName, 'edit_')   => ['select', 'read', 'write'],
            str_starts_with($legacyName, 'delete_') => ['select', 'read', 'delete'],
            str_starts_with($legacyName, 'manage_') => $validKeys,
            default                                 => ['select', 'read'],
        };

        return array_values(array_intersect($flags, $validKeys));
    }
}
