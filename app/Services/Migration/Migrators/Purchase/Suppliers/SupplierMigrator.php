<?php

namespace App\Services\Migration\Migrators\Purchase\Suppliers;

use App\Models\Purchase\Supplier;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SupplierMigrator extends BaseMigrator {
    protected string $sourceTable      = 'suppliers';
    protected string $sourcePrimaryKey = 'supplier_id';
    protected string $targetTable      = 'suppliers';
    protected string $targetModel      = Supplier::class;

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable}");

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $existingId = $this->getNewId($this->sourceTable, $record->{$this->sourcePrimaryKey});
                    $newUlid    = $existingId ?? (string) Str::ulid();

                    $mappedData = [
                        'id'          => $newUlid,
                        'name'        => trim((string) ($record->supp_name ?: "Legacy Supplier {$record->{$this->sourcePrimaryKey}}")),
                        'phone'       => $this->nullableString($record->contact),
                        'email'       => $this->nullableString($record->email),
                        'banks'       => $this->buildBanks($record),
                        'street'      => $this->nullableString($record->address),
                        'city'        => $this->nullableString($record->city),
                        'province'    => $this->nullableString($record->state),
                        'zip_code'    => $this->nullableString($record->zipcode),
                        'country_id'  => null,
                        'is_disabled' => ((int) ($record->inactive ?? 0)) === 1,
                        'created_at'  => $record->created_at,
                        'updated_at'  => $record->updated_at,
                    ];

                    DB::table($this->targetTable)->updateOrInsert(
                        ['id' => $newUlid],
                        $mappedData,
                    );

                    $this->mapId($this->sourceTable, $record->{$this->sourcePrimaryKey}, $newUlid);
                    $this->recordModelLog($this->targetModel, $newUlid, $mappedData);
                }
            });

        $this->log("Migrasi {$this->sourceTable} selesai.");
    }

    protected function nullableString(mixed $value): ?string {
        $stringValue = trim((string) ($value ?? ''));

        return $stringValue === '' ? null : $stringValue;
    }

    protected function buildBanks(object $record): ?array {
        $banks = array_values(array_filter([
            $this->nullableString($record->bank_account01 ?? null),
            $this->nullableString($record->bank_account02 ?? null),
        ]));

        return $banks === [] ? null : $banks;
    }
}

