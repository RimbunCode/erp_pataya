<?php

namespace App\Services\CRM;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Events\Core\DocumentSubmitted;
use App\Models\Core\FormatingSeries;
use App\Models\CRM\Quotation;
use App\Models\CRM\QuotationItem;
use App\Models\CRM\QuotationSection;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Models\Model;
use App\Services\Finances\Tax\ItemTaxSelection;
use App\Services\Finances\Tax\OrderTaxApplier;
use App\Traits\HasDefaultDelete;
use Illuminate\Support\Collection;
use Symfony\Component\Uid\Ulid;

class QuotationService implements SubmitableService {
    use HasDefaultDelete;

    private function fillRelations(array $data): array {
        $data['customer_id']    = $data['customer']['id'] ?? null;
        $data['opportunity_id'] = $data['opportunity']['id'] ?? null;

        return $data;
    }

    /**
     * Mengisi relasi baris item (item, satuan, pajak) dari payload LinkModel dan `basic_amount` (quantity * price).
     * Pajak majemuk: kolom `tax_id`/`tax_rate` mencerminkan Pajak Utama (pajak pertama) dan `tax_amount`/`amount`
     * ditulis `OrderTaxApplier` (TaxEngine, Q-MT-12 Opsi A) setelah item tersimpan. Tarif tiap pajak berasal dari versi
     * aturan pada tanggal Quotation, sehingga Quotation tersimpan tidak berubah oleh perubahan master pajak sesudahnya
     * (menggantikan `keepTaxRate` lama).
     *
     * @param  array<string, mixed>  $item
     * @param  array<string, TaxRuleVersion>  $taxRules
     * @return array<string, mixed>
     */
    private function fillItemRelations(array $item, array $taxRules): array {
        $primaryTaxId = ItemTaxSelection::rowTaxIds($item)[0] ?? null;
        $taxRule      = $taxRules[$primaryTaxId ?? ''] ?? null;

        $item['item_id']      = $item['item']['id'];
        $item['item_unit_id'] = $item['item_unit']['id'] ?? null;
        $item['tax_id']       = $primaryTaxId;
        $item['tax_rate']     = $taxRule !== null ? (float) $taxRule->rate : 0;
        $item['price']        = $item['price'] ?? 0;

        $item['basic_amount'] = (float) $item['quantity'] * (float) $item['price'];
        $item['tax_amount']   = 0;
        $item['amount']       = $item['basic_amount'];

        return $item;
    }

    /**
     * Menghitung pajak semua item lewat `TaxEngine` dan mengembalikan total header (jumlah nilai item).
     *
     * @param  Collection<int, QuotationItem>  $items
     * @param  array<string, Tax>  $taxes
     * @param  array<string, TaxRuleVersion>  $taxRules
     * @param  array<string, list<string>>  $itemTaxIds
     * @return array{basic_amount: float, tax_amount: float, amount: float}
     */
    private function applyItemTaxes(Quotation $quotation, Collection $items, array $taxes, array $taxRules, array $itemTaxIds, mixed $date): array {
        app(OrderTaxApplier::class)->apply($quotation, $items, $taxes, $taxRules, $itemTaxIds, $date, null);

        return [
            'basic_amount' => (float) $items->sum('basic_amount'),
            'tax_amount'   => (float) $items->sum('tax_amount'),
            'amount'       => (float) $items->sum('amount'),
        ];
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
                'title'        => $section['title'],
                'content'      => $section['content'],
                'content_json' => $section['content_json'] ?? null,
                'order'        => $section['order'] ?? $index,
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
        $applier  = app(OrderTaxApplier::class);
        $taxes    = $applier->loadTaxes($data['items']);
        $taxRules = $applier->resolveRules($data['items'], $taxes, $data['date'] ?? null);

        $data['code'] = FormatingSeries::generate(Quotation::class, $data, true);
        $quotation    = Quotation::create($this->fillRelations($data));

        $items      = collect();
        $itemTaxIds = [];
        foreach ($data['items'] as $item) {
            $itemModel                                 = $quotation->items()->create($this->fillItemRelations($item, $taxRules));
            $itemTaxIds[(string) $itemModel->getKey()] = ItemTaxSelection::rowTaxIds($item);
            $items->push($itemModel);
        }
        $quotation->update($this->applyItemTaxes($quotation, $items, $taxes, $taxRules, $itemTaxIds, $data['date'] ?? null));

        $this->syncSections($quotation, $data['sections'] ?? []);

        return $quotation;
    }

    public function update(Model $quotation, array $data): Model {
        $applier  = app(OrderTaxApplier::class);
        $taxes    = $applier->loadTaxes($data['items']);
        $taxRules = $applier->resolveRules($data['items'], $taxes, $data['date'] ?? null);

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

        $items      = collect();
        $itemTaxIds = [];
        foreach ($data['items'] as $item) {
            $itemModel = Ulid::isValid($item['id']) ? $existingItems->get($item['id']) : null;

            if ($itemModel) {
                $itemModel->fill($this->fillItemRelations($item, $taxRules));
                $itemModel->save();
            } else {
                $itemModel = $quotation->items()->create($this->fillItemRelations($item, $taxRules));
            }

            $itemTaxIds[(string) $itemModel->getKey()] = ItemTaxSelection::rowTaxIds($item);
            $items->push($itemModel);
        }
        $quotation->fill($this->applyItemTaxes($quotation, $items, $taxes, $taxRules, $itemTaxIds, $data['date'] ?? null));
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
            event(new DocumentSubmitted($quotation, $quotation->referenceable));
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
        $model->update([
            'status' => FormStatus::SUBMITTED,
        ]);

        return $model;
    }

    public function onRejected(Model $model): mixed {
        $model->update([
            'status' => FormStatus::REJECTED,
        ]);

        return $model;
    }
}
