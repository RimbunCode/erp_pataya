<?php

namespace App\Services\Migration\Migrators\Sales\InternalOrders;

use App\Enums\FormStatus;
use App\Models\Sales\InternalOrder;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InternalOrderMigrator extends BaseMigrator {
    protected string $sourceTable      = 'internal_orders';
    protected string $sourcePrimaryKey = 'id';
    protected string $targetTable      = 'internal_orders';
    protected string $targetModel      = InternalOrder::class;

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable}");

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $existingId = $this->getNewId($this->sourceTable, $record->{$this->sourcePrimaryKey});
                    $newUlid    = $existingId ?? (string) Str::ulid();
                    $code       = $this->buildCode($record);

                    $mappedData = [
                        'id'              => $newUlid,
                        'date'            => $record->ord_date,
                        'code'            => $code,
                        'branch_id'       => $this->resolveDefaultBranchId(),
                        'status'          => $this->mapLegacyStatus($record->status ?? null),
                        'created_by_id'   => $this->resolveCreatedById($record->person_id ?? null),
                        'submitted_at'    => null,
                        'canceled_at'     => null,
                        'revision_number' => 0,
                        'amended_from_id' => null,
                        'additional_data' => [
                            'legacy_id'           => $record->{$this->sourcePrimaryKey},
                            'legacy_breakdown_id' => $record->breakdown_id ?? null,
                            'legacy_reference'    => $record->reference ?? null,
                            'legacy_status'       => $record->status ?? null,
                        ],
                        'deleted_at'      => $record->deleted_at,
                        'created_at'      => $record->created_at,
                        'updated_at'      => $record->updated_at,
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

    /**
     * @return array<int, FormStatus>
     */
    protected function mapLegacyStatus(mixed $legacyStatus): array {
        // TODO: sesuaikan mapping status legacy internal order ke status ERP.
        return $this->defaultLegacyStatus();
    }

    protected function buildCode(object $record): string {
        $reference = trim((string) ($record->reference ?? ''));
        if ($reference !== '') {
            return $reference;
        }

        $legacyId = (string) $record->{$this->sourcePrimaryKey};
        $year     = $this->extractShortYear($record->created_at ?? $record->ord_date ?? null);

        return "IO-{$legacyId}/{$year}";
    }

    protected function extractShortYear(mixed $date): string {
        $timestamp = strtotime((string) ($date ?? ''));

        return $timestamp ? date('y', $timestamp) : date('y');
    }
}
