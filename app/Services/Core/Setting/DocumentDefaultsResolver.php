<?php

namespace App\Services\Core\Setting;

use App\Enums\DefaultsDocumentType;
use App\Models\Finances\PaymentMethod;
use App\Models\Finances\PaymentTermTemplate;
use App\Models\Finances\PaymentTermTemplateItem;
use App\Models\Finances\Tax;
use App\Models\Inventory\InventorySetting;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\PurchaseSetting;
use App\Models\Sales\SalesSetting;

class DocumentDefaultsResolver {
    public function __construct(private SettingsService $settings) {}

    /**
     * @return array{tax_id: ?string, tax: ?array<string, mixed>, warehouse_id: ?string, warehouse: ?array<string, mixed>, payment_term_template: ?array{id: string, items: list<array<string, mixed>>}}
     */
    public function defaultsFor(DefaultsDocumentType $type): array {
        $setting = match ($type) {
            DefaultsDocumentType::PurchaseOrder,
            DefaultsDocumentType::PurchaseReceipt,
            DefaultsDocumentType::PurchaseInvoice => $this->settings->get(PurchaseSetting::class),
            DefaultsDocumentType::SalesOrder,
            DefaultsDocumentType::DeliveryNote,
            DefaultsDocumentType::SalesInvoice,
            DefaultsDocumentType::Quotation => $this->settings->get(SalesSetting::class),
        };

        $taxId = match ($type) {
            DefaultsDocumentType::PurchaseOrder,
            DefaultsDocumentType::PurchaseInvoice,
            DefaultsDocumentType::SalesOrder,
            DefaultsDocumentType::SalesInvoice,
            DefaultsDocumentType::Quotation => $setting->default_tax_id,
            DefaultsDocumentType::PurchaseReceipt,
            DefaultsDocumentType::DeliveryNote => null,
        };

        $warehouseId = $this->warehouseSettingId($type, $setting);
        if ($warehouseId !== null && ! $this->warehouseIsActive($warehouseId)) {
            $warehouseId = null;
        }
        if ($warehouseId === null && $this->usesWarehouse($type)) {
            $inventoryWarehouseId = $this->settings->get(InventorySetting::class)->default_warehouse_id;
            $warehouseId          = $inventoryWarehouseId !== null && $this->warehouseIsActive($inventoryWarehouseId)
                ? $inventoryWarehouseId
                : null;
        }

        $tax       = $taxId !== null ? Tax::query()->find($taxId) : null;
        $warehouse = $warehouseId !== null
            ? Warehouse::withoutBranch()->with('branch')->find($warehouseId)
            : null;

        return [
            'tax_id' => $tax?->id,
            'tax'    => $tax === null
                ? null
                : [...$tax->only(['id', 'name', 'rate']), 'templateLink' => Tax::templateLink(), 'thisModel' => Tax::class],
            'warehouse_id' => $warehouse?->id,
            'warehouse'    => $warehouse === null
                ? null
                : [...$warehouse->only(['id', 'branch_id', 'name', 'code']), 'title' => $warehouse->title, 'templateLink' => Warehouse::templateLink(), 'thisModel' => Warehouse::class],
            'payment_term_template' => $this->paymentTermTemplate($type, $setting),
        ];
    }

    private function warehouseSettingId(DefaultsDocumentType $type, PurchaseSetting|SalesSetting $setting): ?string {
        return match ($type) {
            DefaultsDocumentType::PurchaseOrder,
            DefaultsDocumentType::PurchaseReceipt => $setting->default_target_warehouse_id,
            DefaultsDocumentType::SalesOrder,
            DefaultsDocumentType::DeliveryNote => $setting->default_source_warehouse_id,
            DefaultsDocumentType::PurchaseInvoice,
            DefaultsDocumentType::SalesInvoice,
            DefaultsDocumentType::Quotation => null,
        };
    }

    private function warehouseIsActive(string $warehouseId): bool {
        return Warehouse::withoutBranch()->whereKey($warehouseId)->exists();
    }

    private function usesWarehouse(DefaultsDocumentType $type): bool {
        return match ($type) {
            DefaultsDocumentType::PurchaseOrder,
            DefaultsDocumentType::PurchaseReceipt,
            DefaultsDocumentType::SalesOrder,
            DefaultsDocumentType::DeliveryNote => true,
            DefaultsDocumentType::PurchaseInvoice,
            DefaultsDocumentType::SalesInvoice,
            DefaultsDocumentType::Quotation => false,
        };
    }

    private function paymentTermTemplate(DefaultsDocumentType $type, PurchaseSetting|SalesSetting $setting): ?array {
        $templateId = match ($type) {
            DefaultsDocumentType::PurchaseOrder,
            DefaultsDocumentType::PurchaseInvoice,
            DefaultsDocumentType::SalesOrder,
            DefaultsDocumentType::SalesInvoice => $setting->default_payment_term_template_id,
            DefaultsDocumentType::PurchaseReceipt,
            DefaultsDocumentType::DeliveryNote,
            DefaultsDocumentType::Quotation => null,
        };

        if ($templateId === null) {
            return null;
        }

        $template = PaymentTermTemplate::query()->find($templateId);
        if ($template === null) {
            return null;
        }

        $items = $template->items()->with('paymentMethod')->get();

        return [
            'id'    => $template->id,
            'items' => $items->map(function (PaymentTermTemplateItem $item): array {
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
