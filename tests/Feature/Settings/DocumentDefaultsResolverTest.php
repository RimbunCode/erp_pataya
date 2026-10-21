<?php

namespace Tests\Feature\Settings;

use App\Enums\DefaultsDocumentType;
use App\Models\Core\Branch;
use App\Models\Finances\PaymentMethod;
use App\Models\Finances\PaymentTermTemplate;
use App\Models\Finances\PaymentTermTemplateItem;
use App\Models\Finances\Tax;
use App\Models\Inventory\InventorySetting;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\PurchaseSetting;
use App\Models\Sales\SalesSetting;
use App\Services\Core\Setting\DocumentDefaultsResolver;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DocumentDefaultsResolverTest extends TestCase {
    use RefreshDatabase;

    public function test_resolves_module_defaults_only_for_relevant_document_types(): void {
        $purchaseTax       = $this->createTax('Purchase tax');
        $salesTax          = $this->createTax('Sales tax');
        $purchaseWarehouse = $this->createWarehouse('Purchase warehouse');
        $salesWarehouse    = $this->createWarehouse('Sales warehouse');
        $paymentMethod     = PaymentMethod::query()->create(['name' => 'Purchase bank transfer']);
        $purchaseTemplate  = $this->createPaymentTermTemplate('Purchase terms', $paymentMethod);
        $salesTemplate     = $this->createPaymentTermTemplate('Sales terms');

        PurchaseSetting::current()->fill([
            'default_tax_id'                   => $purchaseTax->id,
            'default_target_warehouse_id'      => $purchaseWarehouse->id,
            'default_payment_term_template_id' => $purchaseTemplate->id,
        ])->save();
        SalesSetting::current()->fill([
            'default_tax_id'                   => $salesTax->id,
            'default_source_warehouse_id'      => $salesWarehouse->id,
            'default_payment_term_template_id' => $salesTemplate->id,
        ])->save();

        $resolver = new DocumentDefaultsResolver(new SettingsService);

        $this->assertSame([
            'tax_id'                => $purchaseTax->id,
            'tax'                   => $this->taxPayload($purchaseTax),
            'warehouse_id'          => $purchaseWarehouse->id,
            'warehouse'             => $this->warehousePayload($purchaseWarehouse),
            'payment_term_template' => $this->templatePayload($purchaseTemplate),
        ], $resolver->defaultsFor(DefaultsDocumentType::PurchaseOrder));
        $this->assertSame([
            'tax_id'                => null,
            'tax'                   => null,
            'warehouse_id'          => $purchaseWarehouse->id,
            'warehouse'             => $this->warehousePayload($purchaseWarehouse),
            'payment_term_template' => null,
        ], $resolver->defaultsFor(DefaultsDocumentType::PurchaseReceipt));
        $this->assertSame([
            'tax_id'                => $purchaseTax->id,
            'tax'                   => $this->taxPayload($purchaseTax),
            'warehouse_id'          => null,
            'warehouse'             => null,
            'payment_term_template' => $this->templatePayload($purchaseTemplate),
        ], $resolver->defaultsFor(DefaultsDocumentType::PurchaseInvoice));
        $this->assertSame([
            'tax_id'                => $salesTax->id,
            'tax'                   => $this->taxPayload($salesTax),
            'warehouse_id'          => $salesWarehouse->id,
            'warehouse'             => $this->warehousePayload($salesWarehouse),
            'payment_term_template' => $this->templatePayload($salesTemplate),
        ], $resolver->defaultsFor(DefaultsDocumentType::SalesOrder));
        $this->assertSame([
            'tax_id'                => null,
            'tax'                   => null,
            'warehouse_id'          => $salesWarehouse->id,
            'warehouse'             => $this->warehousePayload($salesWarehouse),
            'payment_term_template' => null,
        ], $resolver->defaultsFor(DefaultsDocumentType::DeliveryNote));
        $this->assertSame([
            'tax_id'                => $salesTax->id,
            'tax'                   => $this->taxPayload($salesTax),
            'warehouse_id'          => null,
            'warehouse'             => null,
            'payment_term_template' => $this->templatePayload($salesTemplate),
        ], $resolver->defaultsFor(DefaultsDocumentType::SalesInvoice));
        $this->assertSame([
            'tax_id'                => $salesTax->id,
            'tax'                   => $this->taxPayload($salesTax),
            'warehouse_id'          => null,
            'warehouse'             => null,
            'payment_term_template' => null,
        ], $resolver->defaultsFor(DefaultsDocumentType::Quotation));
    }

    public function test_uses_inventory_warehouse_when_module_default_is_empty(): void {
        $warehouse = $this->createWarehouse('Inventory fallback warehouse');
        InventorySetting::current()->fill(['default_warehouse_id' => $warehouse->id])->save();

        $resolver = new DocumentDefaultsResolver(new SettingsService);

        $this->assertSame($warehouse->id, $resolver->defaultsFor(DefaultsDocumentType::PurchaseOrder)['warehouse_id']);
        $this->assertSame($warehouse->id, $resolver->defaultsFor(DefaultsDocumentType::DeliveryNote)['warehouse_id']);
    }

    public function test_ignores_soft_deleted_default_references(): void {
        $tax       = $this->createTax('Deleted default tax');
        $warehouse = $this->createWarehouse('Deleted default warehouse');
        $template  = $this->createPaymentTermTemplate('Deleted default terms');

        PurchaseSetting::current()->fill([
            'default_tax_id'                   => $tax->id,
            'default_target_warehouse_id'      => $warehouse->id,
            'default_payment_term_template_id' => $template->id,
        ])->save();

        $tax->delete();
        $warehouse->delete();
        $template->delete();

        $defaults = (new DocumentDefaultsResolver(new SettingsService))
            ->defaultsFor(DefaultsDocumentType::PurchaseOrder);

        $this->assertNull($defaults['tax_id']);
        $this->assertNull($defaults['tax']);
        $this->assertNull($defaults['warehouse_id']);
        $this->assertNull($defaults['warehouse']);
        $this->assertNull($defaults['payment_term_template']);
    }

    private function createTax(string $name): Tax {
        return Tax::query()->create(['name' => $name, 'rate' => 11]);
    }

    private function createWarehouse(string $name): Warehouse {
        $branch = Branch::query()->create(['name' => $name . ' branch']);

        return Warehouse::query()->create([
            'branch_id' => $branch->id,
            'name'      => $name,
            'code'      => strtoupper(substr(sha1($name), 0, 8)),
        ]);
    }

    private function createPaymentTermTemplate(string $name, ?PaymentMethod $paymentMethod = null): PaymentTermTemplate {
        $template = PaymentTermTemplate::query()->create(['name' => $name]);
        PaymentTermTemplateItem::query()->create([
            'payment_term_template_id' => $template->id,
            'due_date_based_on'        => 'days_after_invoice_date',
            'credit_period'            => 30,
            'invoice_portion'          => 100,
            'discount_type'            => null,
            'discount'                 => null,
            'description'              => 'Net payment terms',
            'payment_method_id'        => $paymentMethod?->id,
        ]);

        return $template;
    }

    /** @return array<string, mixed> */
    private function warehousePayload(Warehouse $warehouse): array {
        $warehouse->load('branch');

        return [
            'id'           => $warehouse->id,
            'branch_id'    => $warehouse->branch_id,
            'name'         => $warehouse->name,
            'code'         => $warehouse->code,
            'title'        => $warehouse->title,
            'templateLink' => Warehouse::templateLink(),
            'thisModel'    => Warehouse::class,
        ];
    }

    /** @return array<string, mixed> */
    private function taxPayload(Tax $tax): array {
        return [...$tax->only(['id', 'name', 'rate']), 'templateLink' => Tax::templateLink(), 'thisModel' => Tax::class];
    }

    /** @return array{id: string, items: array<int, array<string, mixed>>} */
    private function templatePayload(PaymentTermTemplate $template): array {
        return [
            'id'    => $template->id,
            'items' => $template->items()->with('paymentMethod')->get()->map(function (PaymentTermTemplateItem $item): array {
                $payload = $item->toArray();
                if ($item->paymentMethod !== null) {
                    $payload['payment_method']['templateLink'] = PaymentMethod::templateLink();
                    $payload['payment_method']['thisModel']    = PaymentMethod::class;
                }

                return $payload;
            })->all(),
        ];
    }
}
