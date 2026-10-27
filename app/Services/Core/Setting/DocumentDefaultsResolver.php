<?php

namespace App\Services\Core\Setting;

use App\Enums\DefaultsDocumentType;
use App\Models\Core\DefaultRules\DefaultTaxRule;
use App\Models\Core\DefaultRules\DefaultWarehouseRule;
use App\Models\Finances\PaymentMethod;
use App\Models\Finances\PaymentTermTemplate;
use App\Models\Finances\PaymentTermTemplateItem;
use App\Models\Finances\Tax;
use App\Models\Inventory\InventorySetting;
use App\Models\Inventory\Item;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\PurchaseSetting;
use App\Models\Sales\SalesSetting;

class DocumentDefaultsResolver {
    private DefaultRuleMatcher $ruleMatcher;

    public function __construct(
        private SettingsService $settings,
        ?DefaultRuleMatcher $ruleMatcher = null,
    ) {
        $this->ruleMatcher = $ruleMatcher ?? new DefaultRuleMatcher;
    }

    /**
     * `taxes` memuat objek pajak dalam urutan yang sama dengan `tax_ids`. `tax_optional` true hanya bila
     * aturan "tanpa pajak" eksplisit (tax_id null) cocok untuk item; tanpa aturan, dengan referensi aturan
     * rusak, atau tanpa default modul pajak tetap wajib.
     *
     * @param  list<string>  $itemIds
     * @return array<string, array{tax_ids: list<string>, taxes: list<array<string, mixed>>, tax_optional: bool, warehouse_id: ?string, warehouse: ?array<string, mixed>}>
     */
    public function resolveForItems(DefaultsDocumentType $type, array $itemIds): array {
        if ($itemIds === []) {
            return [];
        }

        $items = Item::query()
            ->whereIn('id', array_values(array_unique($itemIds)))
            ->get(['id', 'type', 'is_stock_item', 'category_id']);

        $taxRuleRecords = DefaultTaxRule::query()
            ->where('module', $type->module())
            ->with(['tax', 'itemCategory'])
            ->get()
            ->filter(
                fn (DefaultTaxRule $rule): bool => $rule->item_category_id === null || $rule->itemCategory !== null,
            )
            // Aturan "tanpa pajak" hanya berlaku untuk SO/SI; pada dokumen lain diabaikan agar pajak tetap wajib.
            ->filter(
                fn (DefaultTaxRule $rule): bool => $rule->tax_id !== null || $type->supportsNoTaxRule(),
            )
            ->values();

        // tax_id null = "tanpa pajak" eksplisit; tax_id terisi tetapi pajaknya terhapus = referensi rusak.
        $taxRules = $taxRuleRecords
            ->map(fn (DefaultTaxRule $rule): DefaultRule => $this->ruleFromRecord(
                $rule,
                $rule->tax_id !== null && $rule->tax === null ? null : $rule->tax_id,
                $rule->tax_id !== null && $rule->tax === null,
            ))
            ->all();
        $taxPayloads = $taxRuleRecords
            ->filter(fn (DefaultTaxRule $rule): bool => $rule->tax !== null)
            ->mapWithKeys(fn (DefaultTaxRule $rule): array => [$rule->tax_id => $this->taxPayload($rule->tax)])
            ->all();

        $warehouseRuleRecords = DefaultWarehouseRule::query()
            ->where('module', $type->module())
            ->with([
                'warehouse' => fn ($query) => $query->withoutBranch()->with('branch'),
                'itemCategory',
            ])
            ->get()
            ->filter(
                fn (DefaultWarehouseRule $rule): bool => $rule->item_category_id === null || $rule->itemCategory !== null,
            )
            ->values();

        $warehousePayloads = $warehouseRuleRecords
            ->filter(fn (DefaultWarehouseRule $rule): bool => $rule->warehouse !== null)
            ->mapWithKeys(fn (DefaultWarehouseRule $rule): array => [$rule->warehouse_id => $this->warehousePayload($rule->warehouse)])
            ->all();
        $warehouseRules = $warehouseRuleRecords
            ->map(fn (DefaultWarehouseRule $rule): DefaultRule => $this->ruleFromRecord(
                $rule,
                $rule->warehouse === null ? null : $rule->warehouse_id,
                $rule->warehouse === null,
            ))
            ->all();

        $moduleDefaults = $this->defaultsFor($type);
        $results        = [];
        foreach ($items as $item) {
            $itemAttributes = new ItemAttributes(
                $item->type,
                (bool) $item->is_stock_item,
                $item->category_id,
            );
            $taxRule = $this->ruleMatcher->match($taxRules, $type->value, $itemAttributes);
            // Aturan cocok dengan referensi rusak jatuh ke default modul, seperti tidak ada aturan.
            $useModuleTax = $taxRule === null || $taxRule->referenceBroken;
            $taxId        = $useModuleTax ? $moduleDefaults['tax_id'] : $taxRule->value;
            $taxOptional  = ! $useModuleTax && $taxRule->value === null;
            $taxPayload   = $taxId === null
                ? null
                : ($taxPayloads[$taxId] ?? ($moduleDefaults['tax_id'] === $taxId ? $moduleDefaults['tax'] : null));

            $warehouseId = null;
            if ($itemAttributes->isStockItem && $type->supportsWarehouseDefault()) {
                $warehouseRule = $this->ruleMatcher->match($warehouseRules, $type->value, $itemAttributes);
                $warehouseId   = $warehouseRule === null || $warehouseRule->referenceBroken
                    ? $moduleDefaults['warehouse_id']
                    : $warehouseRule->value;
            }

            $warehouse = $warehouseId === null
                ? null
                : ($warehousePayloads[$warehouseId] ?? (
                    $moduleDefaults['warehouse_id'] === $warehouseId ? $moduleDefaults['warehouse'] : null
                ));

            $results[$item->id] = [
                'tax_ids'      => $taxId === null ? [] : [$taxId],
                'taxes'        => $taxPayload === null ? [] : [$taxPayload],
                'tax_optional' => $taxOptional,
                'warehouse_id' => $warehouseId,
                'warehouse'    => $warehouse,
            ];
        }

        return $results;
    }

    private function ruleFromRecord(DefaultTaxRule|DefaultWarehouseRule $rule, ?string $value, bool $referenceBroken = false): DefaultRule {
        return new DefaultRule(
            $rule->document_type,
            $rule->item_type,
            $rule->is_stock_item,
            $rule->item_category_id,
            $value,
            (int) $rule->priority,
            $referenceBroken,
        );
    }

    /** @return array<string, mixed> */
    private function taxPayload(Tax $tax): array {
        return [...$tax->only(['id', 'name', 'rate']), 'templateLink' => Tax::templateLink(), 'thisModel' => Tax::class];
    }

    /**
     * @return array{tax_id: ?string, tax: ?array<string, mixed>, warehouse_id: ?string, warehouse: ?array<string, mixed>, payment_term_template: ?array{id: string, items: list<array<string, mixed>>}}
     */
    public function defaultsFor(DefaultsDocumentType $type): array {
        $setting = match ($type) {
            DefaultsDocumentType::PurchaseOrder,
            DefaultsDocumentType::PurchaseReceipt,
            DefaultsDocumentType::PurchaseInvoice => $this->settings->getForRead(PurchaseSetting::class),
            DefaultsDocumentType::SalesOrder,
            DefaultsDocumentType::DeliveryNote,
            DefaultsDocumentType::SalesInvoice,
            DefaultsDocumentType::Quotation => $this->settings->getForRead(SalesSetting::class),
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
            $inventoryWarehouseId = $this->settings->getForRead(InventorySetting::class)->default_warehouse_id;
            $warehouseId          = $inventoryWarehouseId !== null && $this->warehouseIsActive($inventoryWarehouseId)
                ? $inventoryWarehouseId
                : null;
        }

        $tax       = $taxId !== null ? Tax::query()->find($taxId) : null;
        $warehouse = $warehouseId !== null
            ? Warehouse::withoutBranch()->with('branch')->find($warehouseId)
            : null;

        return [
            'tax_id'                => $tax?->id,
            'tax'                   => $tax === null ? null : $this->taxPayload($tax),
            'warehouse_id'          => $warehouse?->id,
            'warehouse'             => $warehouse === null ? null : $this->warehousePayload($warehouse),
            'payment_term_template' => $this->paymentTermTemplate($type, $setting),
        ];
    }

    /** @return array<string, mixed> */
    private function warehousePayload(Warehouse $warehouse): array {
        return [
            ...$warehouse->only(['id', 'branch_id', 'name', 'code']),
            'title'        => $warehouse->title,
            'templateLink' => Warehouse::templateLink(),
            'thisModel'    => Warehouse::class,
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
        return $type->supportsWarehouseDefault();
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
