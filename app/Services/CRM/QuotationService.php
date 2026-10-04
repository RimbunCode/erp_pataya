<?php

namespace App\Services\CRM;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\CRM\Quotation;
use App\Models\CRM\QuotationSection;
use App\Models\Finances\Tax;
use App\Models\Model;
use App\Traits\HasDefaultDelete;
use Symfony\Component\Uid\Ulid;

class QuotationService implements SubmitableService {
    use HasDefaultDelete;

    private function fillRelations(array $data): array {
        $data['customer_id']    = $data['customer']['id'] ?? null;
        $data['opportunity_id'] = $data['opportunity']['id'] ?? null;

        return $data;
    }

    /**
     * Mengisi relasi baris item (item, satuan, pajak) dari payload LinkModel dan
     * menghitung basic_amount, tax_amount, amount secara eksplisit. Setelah
     * migration convert_quotation_item_amount_to_stored_column, amount bukan lagi
     * generated column.
     *
     * @param  array<string, mixed>  $item
     * @param  array<string, Tax>  $taxes
     * @return array<string, mixed>
     */
    private function fillItemRelations(array $item, array $taxes, ?float $keepTaxRate = null): array {
        $tax = $taxes[$item['tax']['id'] ?? ''] ?? null;

        $item['item_id']      = $item['item']['id'];
        $item['item_unit_id'] = $item['item_unit']['id'] ?? null;
        $item['tax_id']       = $tax?->id;
        $item['tax_rate']     = $keepTaxRate ?? $tax?->rate ?? 0;
        $item['price']        = $item['price'] ?? 0;

        $basicAmount          = (float) $item['quantity'] * (float) $item['price'];
        $taxAmount            = $basicAmount * $item['tax_rate'] / 100;
        $item['basic_amount'] = $basicAmount;
        $item['tax_amount']   = $taxAmount;
        $item['amount']       = $basicAmount + $taxAmount;

        return $item;
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return array<string, Tax>
     */
    private function loadTaxes(array $items): array {
        $taxIds = collect($items)->pluck('tax.id')->filter()->unique()->values();

        return Tax::whereIn('id', $taxIds)->get()->keyBy('id')->all();
    }

    /**
     * @param  array<int, array<string, mixed>>  $sections
     */
    private function syncSections(Quotation $quotation, array $sections): void {
        $sectionIds = collect($sections)
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();

        QuotationSection::where('quotation_id', $quotation->id)
            ->whereNotIn('id', $sectionIds)
            ->delete();

        $existingSections = QuotationSection::where('quotation_id', $quotation->id)
            ->whereIn('id', $sectionIds)
            ->get()
            ->keyBy('id');

        foreach (array_values($sections) as $index => $section) {
            $attributes = [
                'title'   => $section['title'],
                'content' => $section['content'],
                'order'   => $section['order'] ?? $index,
            ];

            $sectionModel = $existingSections->get($section['id'] ?? '');
            if ($sectionModel) {
                $sectionModel->fill($attributes);
                $sectionModel->save();
            } else {
                $quotation->sections()->create($attributes);
            }
        }
    }

    public function create(array $data): Model {
        $data['code'] = FormatingSeries::generate(Quotation::class, $data, true);
        $quotation    = Quotation::create($this->fillRelations($data));

        $taxes       = $this->loadTaxes($data['items']);
        $basicAmount = 0;
        $taxAmount   = 0;
        $amount      = 0;
        foreach ($data['items'] as $item) {
            $itemModel = $quotation->items()->create($this->fillItemRelations($item, $taxes));
            $basicAmount += $itemModel->basic_amount;
            $taxAmount += $itemModel->tax_amount;
            $amount += $itemModel->amount;
        }
        $quotation->update([
            'basic_amount' => $basicAmount,
            'tax_amount'   => $taxAmount,
            'amount'       => $amount,
        ]);

        $this->syncSections($quotation, $data['sections'] ?? []);

        return $quotation;
    }

    public function update(Model $quotation, array $data): Model {
        $quotation->fillForUpdate($this->fillRelations($data), true);

        $quotation->items()
            ->whereNotIn('id', array_column($data['items'], 'id'))
            ->delete();
        $itemIds = collect($data['items'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingItems = $quotation->items()
            ->whereIn('id', $itemIds)
            ->get()
            ->keyBy('id');

        $taxes       = $this->loadTaxes($data['items']);
        $basicAmount = 0;
        $taxAmount   = 0;
        $amount      = 0;
        foreach ($data['items'] as $item) {
            $itemModel = Ulid::isValid($item['id']) ? $existingItems->get($item['id']) : null;

            if ($itemModel) {
                // Pajak yang tidak diganti mempertahankan tax_rate saat dokumen dibuat,
                // supaya perubahan master pajak tidak mengubah Quotation tersimpan.
                $keepTaxRate = $itemModel->tax_id && $itemModel->tax_id === ($item['tax']['id'] ?? null)
                    ? $itemModel->tax_rate
                    : null;
                $itemModel->fill($this->fillItemRelations($item, $taxes, $keepTaxRate));
                $itemModel->save();
            } else {
                $itemModel = $quotation->items()->create($this->fillItemRelations($item, $taxes));
            }

            $basicAmount += $itemModel->basic_amount;
            $taxAmount += $itemModel->tax_amount;
            $amount += $itemModel->amount;
        }
        $quotation->fill([
            'basic_amount' => $basicAmount,
            'tax_amount'   => $taxAmount,
            'amount'       => $amount,
        ]);
        $quotation->save();

        if (array_key_exists('sections', $data)) {
            $this->syncSections($quotation, $data['sections'] ?? []);
        }

        return $quotation;
    }

    public function submit(Model $quotation): mixed {
        $quotation->update([
            'code' => FormatingSeries::generate(Quotation::class, $quotation),
        ]);

        if ($quotation->referenceable_type && $quotation->referenceable_id) {
            ModelConnection::create([
                'model_type'     => $quotation->referenceable_type,
                'model_id'       => $quotation->referenceable_id,
                'reference_type' => Quotation::class,
                'reference_id'   => $quotation->id,
            ]);
        }

        $quotation->checkApproval();

        return $quotation;
    }

    public function cancel(Model $quotation): mixed {
        $quotation->update([
            'status' => [FormStatus::CANCELED],
        ]);

        return $quotation;
    }

    public function amend(Model $model): mixed {
        return $model;
    }

    public function onApproved(Model $model): mixed {
        return $model;
    }

    public function onRejected(Model $model): mixed {
        return $model;
    }
}
