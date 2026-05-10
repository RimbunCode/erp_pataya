<?php

namespace App\Services\Migration\Migrators\Sales\Customers;

use App\Models\Sales\Customer;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CustomerMigrator extends BaseMigrator {
    protected string $sourceTable      = 'debtors_master';
    protected string $sourcePrimaryKey = 'debtor_no';
    protected string $targetTable      = 'customers';
    protected string $targetModel      = Customer::class;

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
                        'name'        => trim((string) ($record->name ?: "Legacy Customer {$record->{$this->sourcePrimaryKey}}")),
                        'email'       => $this->nullableString($record->email),
                        'phone'       => $this->nullableString($record->phone),
                        'vat'         => $this->nullableString($record->vat_no),
                        'is_disabled' => ((int) ($record->inactive ?? 0)) === 1,
                        'street'      => $this->nullableString($record->address),
                        'city'        => null,
                        'province'    => null,
                        'zip_code'    => null,
                        'country_id'  => null,
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
}

