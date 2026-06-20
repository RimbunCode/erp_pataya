<?php

namespace Database\Seeders;

use App\Enums\FormStatus;
use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Core\Currency;
use App\Models\Finances\Account;
use App\Models\Finances\PaymentMethod;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Finances\Tax;
use App\Models\Inventory\Category;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\Supplier;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\Service\WorkOrder;
use App\Models\Service\WorkOrderItem;
use App\Models\User\Permission;
use App\Models\User\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class ExampleDataSeeder extends Seeder {
    /**
     * Run the database seeds.
     *
     * Generates realistic example data for print template preview.
     * Safe to run multiple times (idempotent) - cleans existing example data first.
     */
    public function run(): void {
        $this->cleanExistingExampleData();

        $branch   = $this->getOrCreateBranch();
        $currency = $this->getOrCreateCurrency();
        $tax      = $this->getOrCreateTax();
        $user     = $this->getOrCreateUser();

        // Create base entities
        $customers  = $this->createCustomers($branch);
        $suppliers  = $this->createSuppliers();
        $warehouses = $this->createWarehouses($branch, $user);
        $items      = $this->createItems();
        $this->getOrCreatePaymentMethod();

        // Create transactional documents
        $this->createSalesOrders($customers, $items, $currency, $branch, $tax, $user, $warehouses);
        $this->createSalesInvoices($customers, $items, $currency, $branch, $tax, $user);
        $this->createPurchaseOrders($suppliers, $items, $currency, $branch, $tax, $user, $warehouses);
        $this->createPurchaseInvoices($suppliers, $items, $currency, $branch, $tax, $user, $warehouses);
        $this->createDeliveryNotes($customers, $items, $branch, $user, $warehouses);
        $this->createWorkOrders($customers, $items, $branch, $user);
    }

    private function cleanExistingExampleData(): void {
        // Clean in reverse dependency order
        // Item models (non-DataTable) are cleaned via their parent's cascade or by parent ID
        $workOrderIds = WorkOrder::exampleData()->pluck('id');
        WorkOrderItem::query()->whereIn('work_order_id', $workOrderIds)->forceDelete();
        WorkOrder::exampleData()->forceDelete();

        $deliveryNoteIds = DeliveryNote::exampleData()->pluck('id');
        DeliveryNoteItem::query()->whereIn('delivery_note_id', $deliveryNoteIds)->forceDelete();
        DeliveryNote::exampleData()->forceDelete();

        $purchaseInvoiceIds = PurchaseInvoice::exampleData()->pluck('id');
        PurchaseInvoiceItem::query()->whereIn('purchase_invoice_id', $purchaseInvoiceIds)->forceDelete();
        PurchaseInvoice::exampleData()->forceDelete();

        $purchaseOrderIds = PurchaseOrder::exampleData()->pluck('id');
        PurchaseOrderItem::query()->whereIn('purchase_order_id', $purchaseOrderIds)->forceDelete();
        PurchaseOrder::exampleData()->forceDelete();

        $salesInvoiceIds = SalesInvoice::exampleData()->pluck('id');
        SalesInvoiceItem::query()->whereIn('sales_invoice_id', $salesInvoiceIds)->forceDelete();
        SalesInvoice::exampleData()->forceDelete();

        $salesOrderIds = SalesOrder::exampleData()->pluck('id');
        SalesOrderItem::query()->whereIn('sales_order_id', $salesOrderIds)->forceDelete();
        SalesOrder::exampleData()->forceDelete();
    }

    private function getOrCreateBranch(): Branch {
        return Branch::query()
            ->whereNull('branchable_type')
            ->whereNull('branchable_id')
            ->first()
            ?? Branch::query()->create([
                'code'                => 'HQ',
                'name'                => 'Head Office',
                'is_main_branch'      => true,
                'is_disabled'         => false,
                'is_example'          => true,
                'billing_address'     => 'same_shipping',
                'shipping_street'     => 'Jl. Sudirman No. 1',
                'shipping_city'       => 'Jakarta Selatan',
                'shipping_state'      => 'DKI Jakarta',
                'shipping_zip_code'   => '12190',
                'shipping_country_id' => 'IDN',
            ]);
    }

    private function getOrCreateCurrency(): Currency {
        return Currency::query()->where('code', 'IDR')->first()
            ?? Currency::query()->create([
                'code' => 'IDR',
                'name' => 'Indonesian Rupiah',
            ]);
    }

    private function getOrCreateTax(): Tax {
        return Tax::exampleData()->first()
            ?? Tax::query()->create([
                'name'       => 'PPN 11%',
                'rate'       => 11,
                'is_example' => true,
            ]);
    }

    private function getOrCreateUser(): User {
        return User::query()->where('username', 'admin')->first()
            ?? User::query()->first()
            ?? User::query()->create([
                'name'       => 'Administrator',
                'username'   => 'admin',
                'email'      => 'admin@example.com',
                'password'   => bcrypt('password'),
                'is_example' => true,
            ]);
    }

    private function getOrCreatePaymentMethod(): PaymentMethod {
        return PaymentMethod::exampleData()->first()
            ?? PaymentMethod::query()->first()
            ?? PaymentMethod::query()->create([
                'name'        => 'Bank Transfer',
                'description' => 'Transfer via bank',
                'is_example'  => true,
            ]);
    }

    /**
     * @return array<int, Customer>
     */
    private function createCustomers(Branch $branch): array {
        $countryCode = Country::query()->value('code') ?? 'IDN';

        $customersData = [
            [
                'name'       => 'PT Maju Bersama',
                'email'      => 'info@majubersama.co.id',
                'phone'      => '021-5551234',
                'vat'        => 'TAX-01.234.567',
                'street'     => 'Jl. Gatot Subroto No. 45',
                'city'       => 'Jakarta Selatan',
                'province'   => 'DKI Jakarta',
                'zip_code'   => '12930',
                'country_id' => $countryCode,
            ],
            [
                'name'       => 'CV Sentosa Abadi',
                'email'      => 'order@sentosaabadi.com',
                'phone'      => '031-7789012',
                'vat'        => 'TAX-02.345.678',
                'street'     => 'Jl. Ahmad Yani No. 88',
                'city'       => 'Surabaya',
                'province'   => 'Jawa Timur',
                'zip_code'   => '60234',
                'country_id' => $countryCode,
            ],
        ];

        $customers = [];
        foreach ($customersData as $data) {
            $customer = Customer::query()->create([
                ...$data,
                'is_example'  => true,
                'is_disabled' => false,
            ]);

            // Create main branch for customer
            Branch::query()->create([
                'code'                => str_replace(' ', '-', $customer->name),
                'name'                => $customer->name,
                'branchable_type'     => Customer::class,
                'branchable_id'       => $customer->id,
                'is_main_branch'      => true,
                'is_disabled'         => false,
                'is_example'          => true,
                'billing_address'     => 'same_shipping',
                'shipping_street'     => $customer->street,
                'shipping_city'       => $customer->city,
                'shipping_state'      => $customer->province,
                'shipping_zip_code'   => $customer->zip_code,
                'shipping_country_id' => $customer->country_id,
            ]);

            $customers[] = $customer;
        }

        return $customers;
    }

    /**
     * @return array<int, Supplier>
     */
    private function createSuppliers(): array {
        $countryCode = Country::query()->value('code') ?? 'IDN';

        $suppliersData = [
            [
                'name'       => 'PT Sumber Material Utama',
                'email'      => 'sales@sumbermaterial.co.id',
                'phone'      => '021-6671234',
                'banks'      => [
                    ['bank' => 'Bank Mandiri', 'no_acc' => '1234567890', 'account' => 'PT Sumber Material Utama'],
                ],
                'street'     => 'Jl. Industri Raya No. 12',
                'city'       => 'Bekasi',
                'province'   => 'Jawa Barat',
                'zip_code'   => '17530',
                'country_id' => $countryCode,
            ],
            [
                'name'       => 'CV Teknik Mandiri',
                'email'      => 'info@teknikmandiri.com',
                'phone'      => '022-4456789',
                'banks'      => [
                    ['bank' => 'Bank BCA', 'no_acc' => '9876543210', 'account' => 'CV Teknik Mandiri'],
                ],
                'street'     => 'Jl. Soekarno Hatta No. 200',
                'city'       => 'Bandung',
                'province'   => 'Jawa Barat',
                'zip_code'   => '40235',
                'country_id' => $countryCode,
            ],
        ];

        $suppliers = [];
        foreach ($suppliersData as $data) {
            $suppliers[] = Supplier::query()->create([
                ...$data,
                'is_example'  => true,
                'is_disabled' => false,
            ]);
        }

        return $suppliers;
    }

    /**
     * @return array<int, Warehouse>
     */
    private function createWarehouses(Branch $branch, User $user): array {
        $warehousesData = [
            ['name' => 'Gudang Utama', 'code' => 'WH-MAIN-EX'],
            ['name' => 'Gudang Transit', 'code' => 'WH-TRANSIT-EX'],
        ];

        $warehouses = [];
        foreach ($warehousesData as $data) {
            $warehouses[] = Warehouse::query()->firstOrCreate(
                ['code' => $data['code']],
                [
                    ...$data,
                    'branch_id'  => $branch->id,
                    'user_id'    => $user->id,
                    'is_example' => true,
                ],
            );
        }

        return $warehouses;
    }

    /**
     * @return array<int, ItemVariant>
     */
    private function createItems(): array {
        $unit = Unit::query()->where('is_default', true)->first()
            ?? Unit::query()->first()
            ?? Unit::query()->create([
                'code'              => 'PCS',
                'name'              => 'Pieces',
                'group'             => 'Quantity',
                'conversion_factor' => 1,
                'is_default'        => true,
                'is_example'        => true,
            ]);

        $category = Category::query()->where('type', 'inventory')->first()
            ?? Category::query()->create([
                'name'       => 'General Goods',
                'type'       => 'inventory',
                'is_example' => true,
            ]);

        $itemsData = [
            ['code' => 'ITM-EX-001', 'name' => 'Pipa Baja 2 Inch', 'price' => 250000],
            ['code' => 'ITM-EX-002', 'name' => 'Helm Safety Standar', 'price' => 85000],
            ['code' => 'ITM-EX-003', 'name' => 'Baut Hexagonal M10', 'price' => 3500],
            ['code' => 'ITM-EX-004', 'name' => 'Selang Hidrolik 1/2"', 'price' => 175000],
            ['code' => 'ITM-EX-005', 'name' => 'Kardus Packaging 40x30', 'price' => 12000],
        ];

        $itemVariants = [];
        foreach ($itemsData as $data) {
            $item = Item::query()->firstOrCreate(
                ['code' => $data['code']],
                [
                    'name'                   => $data['name'],
                    'description'            => "Contoh item: {$data['name']}",
                    'category_id'            => $category->id,
                    'default_unit_id'        => $unit->id,
                    'conversion_factor'      => 1,
                    'stock_minimum'          => 10,
                    'is_disabled'            => false,
                    'allow_alternative_item' => false,
                    'is_stock_item'          => true,
                    'type'                   => 'inventory',
                    'is_example'             => true,
                ],
            );

            $itemUnit = ItemUnit::query()->firstOrCreate(
                ['item_id' => $item->id, 'unit_id' => $unit->id],
                [
                    'conversion_factor'         => 1,
                    'is_default'                => true,
                    'is_manual'                 => false,
                    'generated_by_default_unit' => true,
                ],
            );

            $variant = ItemVariant::query()->firstOrCreate(
                ['code' => $data['code'] . '-V1'],
                [
                    'item_id'                => $item->id,
                    'category_id'            => $category->id,
                    'default_unit_id'        => $unit->id,
                    'item_code'              => $data['code'],
                    'item_name'              => $data['name'],
                    'format_variant'         => 'Standard',
                    'description'            => $data['name'] . ' - Standard variant',
                    'is_disabled'            => false,
                    'allow_alternative_item' => false,
                    'conversion_factor'      => 1,
                    'is_stock_item'          => true,
                    'type'                   => 'inventory',
                    'is_example'             => true,
                ],
            );

            // Store price in a temporary property for use in order items
            $variant->setAttribute('example_price', $data['price']);
            $variant->setAttribute('example_item_unit_id', $itemUnit->id);
            $itemVariants[] = $variant;
        }

        return $itemVariants;
    }

    /**
     * @param  array<int, Customer>  $customers
     * @param  array<int, ItemVariant>  $items
     * @param  array<int, Warehouse>  $warehouses
     */
    private function createSalesOrders(
        array $customers,
        array $items,
        Currency $currency,
        Branch $branch,
        Tax $tax,
        User $user,
        array $warehouses,
    ): void {
        $scenarios = [
            [
                'customer_index' => 0,
                'date'           => Carbon::now()->subDays(7),
                'items'          => [0, 1, 2],
                'quantities'     => [10, 5, 100],
            ],
            [
                'customer_index' => 1,
                'date'           => Carbon::now()->subDays(3),
                'items'          => [3, 4],
                'quantities'     => [20, 50],
            ],
        ];

        foreach ($scenarios as $index => $scenario) {
            $customer       = $customers[$scenario['customer_index']];
            $customerBranch = Branch::query()
                ->where('branchable_type', Customer::class)
                ->where('branchable_id', $customer->id)
                ->where('is_main_branch', true)
                ->first();

            $totalAmount = 0;
            $orderItems  = [];

            foreach ($scenario['items'] as $i => $itemIndex) {
                $item         = $items[$itemIndex];
                $qty          = $scenario['quantities'][$i];
                $price        = $item->getAttribute('example_price');
                $basicAmount  = $price * $qty;
                $taxAmount    = $basicAmount * ($tax->rate / 100);
                $amount       = $basicAmount + $taxAmount;
                $totalAmount += $amount;

                $orderItems[] = [
                    'item'         => $item,
                    'qty'          => $qty,
                    'price'        => $price,
                    'basic_amount' => $basicAmount,
                    'tax_amount'   => $taxAmount,
                    'amount'       => $amount,
                ];
            }

            $salesOrder = SalesOrder::query()->create([
                'code'                 => 'HQ/SO-' . str_pad($index + 1, 4, '0', STR_PAD_LEFT) . '/EX',
                'date'                 => $scenario['date'],
                'customer_id'          => $customer->id,
                'customer_name'        => $customer->name,
                'customer_branch_id'   => $customerBranch?->id,
                'customer_branch_name' => $customerBranch?->name,
                'is_rent'              => false,
                'currency_code'        => $currency->code,
                'base_currency_code'   => $currency->code,
                'exchange_rate'        => 1,
                'discount_amount'      => 0,
                'discount_rate'        => 0,
                'discount_on'          => 'grand_total',
                'amount'               => $totalAmount,
                'branch_id'            => $branch->id,
                'status'               => [FormStatus::SUBMITTED],
                'created_by_id'        => $user->id,
                'submitted_at'         => $scenario['date'],
                'revision_number'      => 0,
                'is_example'           => true,
            ]);

            $warehouse = $warehouses[0];
            foreach ($orderItems as $orderItem) {
                SalesOrderItem::query()->create([
                    'sales_order_id'      => $salesOrder->id,
                    'item_id'             => $orderItem['item']->id,
                    'item_unit_id'        => $orderItem['item']->getAttribute('example_item_unit_id'),
                    'source_warehouse_id' => $warehouse->id,
                    'quantity'            => $orderItem['qty'],
                    'delivered_quantity'  => 0,
                    'billed_quantity'     => 0,
                    'tax_id'              => $tax->id,
                    'conversion_factor'   => 1,
                    'tax_rate'            => $tax->rate,
                    'currency_code'       => $currency->code,
                    'base_currency_code'  => $currency->code,
                    'exchange_rate'       => 1,
                    'price'               => $orderItem['price'],
                ]);
            }
        }
    }

    /**
     * @param  array<int, Customer>  $customers
     * @param  array<int, ItemVariant>  $items
     */
    private function createSalesInvoices(
        array $customers,
        array $items,
        Currency $currency,
        Branch $branch,
        Tax $tax,
        User $user,
    ): void {
        $scenarios = [
            [
                'customer_index' => 0,
                'date'           => Carbon::now()->subDays(5),
                'items'          => [0, 1],
                'quantities'     => [8, 3],
                'discount_rate'  => 5,
            ],
            [
                'customer_index' => 1,
                'date'           => Carbon::now()->subDays(1),
                'items'          => [2, 3, 4],
                'quantities'     => [200, 15, 30],
                'discount_rate'  => 0,
            ],
        ];

        $debitAccount  = Account::query()->where('root_type', 'Asset')->first();
        $incomeAccount = Account::query()->where('root_type', 'Income')->first();

        foreach ($scenarios as $index => $scenario) {
            $customer       = $customers[$scenario['customer_index']];
            $customerBranch = Branch::query()
                ->where('branchable_type', Customer::class)
                ->where('branchable_id', $customer->id)
                ->where('is_main_branch', true)
                ->first();

            $subtotal     = 0;
            $invoiceItems = [];

            foreach ($scenario['items'] as $i => $itemIndex) {
                $item         = $items[$itemIndex];
                $qty          = $scenario['quantities'][$i];
                $price        = $item->getAttribute('example_price');
                $basicAmount  = $price * $qty;
                $taxAmount    = $basicAmount * ($tax->rate / 100);
                $subtotal    += $basicAmount;

                $invoiceItems[] = [
                    'item'         => $item,
                    'qty'          => $qty,
                    'price'        => $price,
                    'basic_amount' => $basicAmount,
                    'tax_amount'   => $taxAmount,
                ];
            }

            $discountAmount = $subtotal * ($scenario['discount_rate'] / 100);
            $totalTax       = collect($invoiceItems)->sum('tax_amount');
            $totalAmount    = $subtotal - $discountAmount + $totalTax;

            $invoice = SalesInvoice::query()->create([
                'code'                 => 'HQ/SalesInvoice-' . str_pad($index + 1, 4, '0', STR_PAD_LEFT) . '/EX',
                'date'                 => $scenario['date'],
                'customer_id'          => $customer->id,
                'customer_name'        => $customer->name,
                'customer_branch_id'   => $customerBranch?->id,
                'customer_branch_name' => $customerBranch?->name,
                'debit_account_id'     => $debitAccount?->id,
                'income_account_id'    => $incomeAccount?->id,
                'amount'               => $totalAmount,
                'paid_amount'          => 0,
                'discount_on'          => 'grand_total',
                'discount_rate'        => $scenario['discount_rate'],
                'discount_amount'      => $discountAmount,
                'currency_code'        => $currency->code,
                'base_currency_code'   => $currency->code,
                'exchange_rate'        => 1,
                'branch_id'            => $branch->id,
                'status'               => [FormStatus::SUBMITTED, FormStatus::UNPAID],
                'created_by_id'        => $user->id,
                'submitted_at'         => $scenario['date'],
                'revision_number'      => 0,
                'is_example'           => true,
            ]);

            foreach ($invoiceItems as $invoiceItem) {
                SalesInvoiceItem::query()->create([
                    'sales_invoice_id'    => $invoice->id,
                    'item_id'             => $invoiceItem['item']->id,
                    'item_unit_id'        => $invoiceItem['item']->getAttribute('example_item_unit_id'),
                    'quantity'            => $invoiceItem['qty'],
                    'returned_quantity'   => 0,
                    'price'               => $invoiceItem['price'],
                    'price_base_currency' => $invoiceItem['price'],
                    'tax_id'              => $tax->id,
                    'conversion_factor'   => 1,
                    'tax_rate'            => $tax->rate,
                    'currency_code'       => $currency->code,
                    'base_currency_code'  => $currency->code,
                    'exchange_rate'       => 1,
                ]);
            }
        }
    }

    /**
     * @param  array<int, Supplier>  $suppliers
     * @param  array<int, ItemVariant>  $items
     * @param  array<int, Warehouse>  $warehouses
     */
    private function createPurchaseOrders(
        array $suppliers,
        array $items,
        Currency $currency,
        Branch $branch,
        Tax $tax,
        User $user,
        array $warehouses,
    ): void {
        $scenarios = [
            [
                'supplier_index' => 0,
                'date'           => Carbon::now()->subDays(14),
                'required_date'  => Carbon::now()->subDays(7),
                'items'          => [0, 2, 4],
                'quantities'     => [50, 500, 100],
                'rates'          => [200000, 2800, 9500],
            ],
            [
                'supplier_index' => 1,
                'date'           => Carbon::now()->subDays(10),
                'required_date'  => Carbon::now()->subDays(3),
                'items'          => [1, 3],
                'quantities'     => [25, 40],
                'rates'          => [72000, 150000],
            ],
        ];

        foreach ($scenarios as $index => $scenario) {
            $supplier    = $suppliers[$scenario['supplier_index']];
            $totalAmount = 0;
            $orderItems  = [];

            foreach ($scenario['items'] as $i => $itemIndex) {
                $item         = $items[$itemIndex];
                $qty          = $scenario['quantities'][$i];
                $rate         = $scenario['rates'][$i];
                $basicAmount  = $rate * $qty;
                $taxAmount    = $basicAmount * ($tax->rate / 100);
                $amount       = $basicAmount + $taxAmount;
                $totalAmount += $amount;

                $orderItems[] = [
                    'item'         => $item,
                    'qty'          => $qty,
                    'rate'         => $rate,
                    'basic_amount' => $basicAmount,
                    'tax_amount'   => $taxAmount,
                    'amount'       => $amount,
                ];
            }

            $purchaseOrder = PurchaseOrder::query()->create([
                'code'                 => 'HQ/PO-' . str_pad($index + 1, 4, '0', STR_PAD_LEFT) . '/EX',
                'date'                 => $scenario['date'],
                'required_date'        => $scenario['required_date'],
                'supplier_id'          => $supplier->id,
                'supplier_name'        => $supplier->name,
                'currency_code'        => $currency->code,
                'base_currency_code'   => $currency->code,
                'exchange_rate'        => 1,
                'amount'               => $totalAmount,
                'amount_base_currency' => $totalAmount,
                'discount_on'          => 'grand_total',
                'discount_rate'        => 0,
                'discount_amount'      => 0,
                'branch_id'            => $branch->id,
                'status'               => [FormStatus::SUBMITTED],
                'created_by_id'        => $user->id,
                'submitted_at'         => $scenario['date'],
                'revision_number'      => 0,
                'is_example'           => true,
            ]);

            $warehouse = $warehouses[0];
            foreach ($orderItems as $orderItem) {
                PurchaseOrderItem::query()->create([
                    'purchase_order_id'   => $purchaseOrder->id,
                    'item_id'             => $orderItem['item']->id,
                    'item_name'           => $orderItem['item']->item_name,
                    'target_warehouse_id' => $warehouse->id,
                    'quantity'            => $orderItem['qty'],
                    'received_quantity'   => 0,
                    'billed_quantity'     => 0,
                    'item_unit_id'        => $orderItem['item']->getAttribute('example_item_unit_id'),
                    'unit_name'           => 'PCS',
                    'conversion_factor'   => 1,
                    'tax_id'              => $tax->id,
                    'tax_rate'            => $tax->rate,
                    'rate'                => $orderItem['rate'],
                ]);
            }
        }
    }

    /**
     * @param  array<int, Supplier>  $suppliers
     * @param  array<int, ItemVariant>  $items
     * @param  array<int, Warehouse>  $warehouses
     */
    private function createPurchaseInvoices(
        array $suppliers,
        array $items,
        Currency $currency,
        Branch $branch,
        Tax $tax,
        User $user,
        array $warehouses,
    ): void {
        $scenarios = [
            [
                'supplier_index' => 0,
                'date'           => Carbon::now()->subDays(5),
                'items'          => [0, 2],
                'quantities'     => [50, 500],
                'rates'          => [200000, 2800],
                'discount_rate'  => 2,
            ],
            [
                'supplier_index' => 1,
                'date'           => Carbon::now()->subDays(2),
                'items'          => [1, 3, 4],
                'quantities'     => [25, 40, 100],
                'rates'          => [72000, 150000, 9500],
                'discount_rate'  => 0,
            ],
        ];

        $expenseAccount = Account::query()->where('root_type', 'Expense')->first();
        $creditAccount  = Account::query()->where('root_type', 'Liability')->first();

        foreach ($scenarios as $index => $scenario) {
            $supplier     = $suppliers[$scenario['supplier_index']];
            $subtotal     = 0;
            $invoiceItems = [];

            foreach ($scenario['items'] as $i => $itemIndex) {
                $item         = $items[$itemIndex];
                $qty          = $scenario['quantities'][$i];
                $rate         = $scenario['rates'][$i];
                $basicAmount  = $rate * $qty;
                $taxAmount    = $basicAmount * ($tax->rate / 100);
                $amount       = $basicAmount + $taxAmount;
                $subtotal    += $basicAmount;

                $invoiceItems[] = [
                    'item'         => $item,
                    'qty'          => $qty,
                    'rate'         => $rate,
                    'basic_amount' => $basicAmount,
                    'tax_amount'   => $taxAmount,
                    'amount'       => $amount,
                ];
            }

            $discountAmount = $subtotal * ($scenario['discount_rate'] / 100);
            $totalTax       = collect($invoiceItems)->sum('tax_amount');
            $totalAmount    = $subtotal - $discountAmount + $totalTax;

            $invoice = PurchaseInvoice::query()->create([
                'code'                    => 'HQ/PurchaseINV-' . str_pad($index + 1, 4, '0', STR_PAD_LEFT) . '/EX',
                'date'                    => $scenario['date'],
                'supplier_id'             => $supplier->id,
                'supplier_name'           => $supplier->name,
                'expanse_head_account_id' => $expenseAccount?->id,
                'credit_account_id'       => $creditAccount?->id,
                'amount'                  => $totalAmount,
                'paid_amount'             => 0,
                'discount_on'             => 'grand_total',
                'discount_rate'           => $scenario['discount_rate'],
                'discount_amount'         => $discountAmount,
                'currency_code'           => $currency->code,
                'base_currency_code'      => $currency->code,
                'exchange_rate'           => 1,
                'branch_id'               => $branch->id,
                'status'                  => [FormStatus::SUBMITTED, FormStatus::UNPAID],
                'created_by_id'           => $user->id,
                'submitted_at'            => $scenario['date'],
                'revision_number'         => 0,
                'is_example'              => true,
            ]);

            $warehouse = $warehouses[0];
            foreach ($invoiceItems as $invoiceItem) {
                PurchaseInvoiceItem::query()->create([
                    'purchase_invoice_id' => $invoice->id,
                    'item_id'             => $invoiceItem['item']->id,
                    'item_name'           => $invoiceItem['item']->item_name,
                    'quantity'            => $invoiceItem['qty'],
                    'returned_quantity'   => 0,
                    'item_unit_id'        => $invoiceItem['item']->getAttribute('example_item_unit_id'),
                    'unit_name'           => 'PCS',
                    'conversion_factor'   => 1,
                    'tax_id'              => $tax->id,
                    'tax_rate'            => $tax->rate,
                    'rate'                => $invoiceItem['rate'],
                ]);
            }
        }
    }

    /**
     * @param  array<int, Customer>  $customers
     * @param  array<int, ItemVariant>  $items
     * @param  array<int, Warehouse>  $warehouses
     */
    private function createDeliveryNotes(
        array $customers,
        array $items,
        Branch $branch,
        User $user,
        array $warehouses,
    ): void {
        $scenarios = [
            [
                'customer_index' => 0,
                'date'           => Carbon::now()->subDays(4),
                'items'          => [0, 1],
                'quantities'     => [8, 3],
            ],
            [
                'customer_index' => 1,
                'date'           => Carbon::now()->subDays(1),
                'items'          => [2, 3, 4],
                'quantities'     => [150, 10, 25],
            ],
        ];

        foreach ($scenarios as $index => $scenario) {
            $customer       = $customers[$scenario['customer_index']];
            $customerBranch = Branch::query()
                ->where('branchable_type', Customer::class)
                ->where('branchable_id', $customer->id)
                ->where('is_main_branch', true)
                ->first();

            $deliveryNote = DeliveryNote::query()->create([
                'code'               => 'HQ/DN-' . str_pad($index + 1, 4, '0', STR_PAD_LEFT) . '/EX',
                'delivery_date'      => $scenario['date'],
                'reference_to_id'    => Permission::query()->where('model', 'LIKE', '%SalesOrder%')->value('id')
                    ?? Permission::query()->value('id'),
                'referenceable_type' => SalesOrder::class,
                'referenceable_id'   => SalesOrder::exampleData()->value('id') ?? $customer->id,
                'customer_id'        => $customer->id,
                'customer_branch_id' => $customerBranch?->id,
                'branch_id'          => $branch->id,
                'status'             => [FormStatus::SUBMITTED],
                'created_by_id'      => $user->id,
                'submitted_at'       => $scenario['date'],
                'revision_number'    => 0,
                'is_example'         => true,
            ]);

            $warehouse = $warehouses[0];
            foreach ($scenario['items'] as $i => $itemIndex) {
                $item = $items[$itemIndex];
                DeliveryNoteItem::query()->create([
                    'delivery_note_id'    => $deliveryNote->id,
                    'referenceable_type'  => DeliveryNote::class,
                    'referenceable_id'    => $deliveryNote->id,
                    'item_id'             => $item->id,
                    'item_unit_id'        => $item->getAttribute('example_item_unit_id'),
                    'source_warehouse_id' => $warehouse->id,
                    'conversion_factor'   => 1,
                    'valuation_rates'     => json_encode([]),
                    'quantity'            => $scenario['quantities'][$i],
                    'returned_quantity'   => 0,
                ]);
            }
        }
    }

    /**
     * @param  array<int, Customer>  $customers
     * @param  array<int, ItemVariant>  $items
     */
    private function createWorkOrders(
        array $customers,
        array $items,
        Branch $branch,
        User $user,
    ): void {
        $scenarios = [
            [
                'customer_index' => 0,
                'date'           => Carbon::now()->subDays(6),
                'items'          => [0, 1, 2],
                'quantities'     => [5, 2, 20],
            ],
            [
                'customer_index' => 1,
                'date'           => Carbon::now()->subDays(2),
                'items'          => [3, 4],
                'quantities'     => [10, 15],
            ],
        ];

        foreach ($scenarios as $index => $scenario) {
            $customer       = $customers[$scenario['customer_index']];
            $customerBranch = Branch::query()
                ->where('branchable_type', Customer::class)
                ->where('branchable_id', $customer->id)
                ->where('is_main_branch', true)
                ->first();

            $workOrder = WorkOrder::query()->create([
                'code'                 => 'HQ/WO-' . str_pad($index + 1, 4, '0', STR_PAD_LEFT) . '/EX',
                'date'                 => $scenario['date'],
                'customer_id'          => $customer->id,
                'customer_name'        => $customer->name,
                'customer_branch_id'   => $customerBranch?->id,
                'customer_branch_name' => $customerBranch?->name,
                'branch_id'            => $branch->id,
                'status'               => [FormStatus::SUBMITTED, FormStatus::IN_PROGRESS],
                'created_by_id'        => $user->id,
                'submitted_at'         => $scenario['date'],
                'started_at'           => $scenario['date']->copy()->addHours(2),
                'revision_number'      => 0,
                'is_example'           => true,
            ]);

            foreach ($scenario['items'] as $i => $itemIndex) {
                $item = $items[$itemIndex];
                WorkOrderItem::query()->create([
                    'work_order_id'        => $workOrder->id,
                    'item_variant_id'      => $item->id,
                    'item_name'            => $item->item_name,
                    'quantity'             => $scenario['quantities'][$i],
                    'ordered_quantity'     => 0,
                    'received_quantity'    => 0,
                    'transferred_quantity' => 0,
                    'item_unit_id'         => $item->getAttribute('example_item_unit_id'),
                    'unit_name'            => 'PCS',
                    'conversion_factor'    => 1,
                ]);
            }
        }
    }
}
