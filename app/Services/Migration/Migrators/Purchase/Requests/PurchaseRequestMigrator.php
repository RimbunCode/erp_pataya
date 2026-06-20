<?php

namespace App\Services\Migration\Migrators\Purchase\Requests;

use App\Enums\FormStatus;
use App\Models\Purchase\PurchaseRequest;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PurchaseRequestMigrator extends BaseMigrator {
    protected string $sourceTable      = 'requisition';
    protected string $sourcePrimaryKey = 'id';
    protected string $targetTable      = 'purchase_requests';
    protected string $targetModel      = PurchaseRequest::class;

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable}");

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $legacyId   = $record->{$this->sourcePrimaryKey};
                    $existingId = $this->getNewId($this->sourceTable, $legacyId);
                    $newUlid    = $existingId ?? (string) Str::ulid();

                    $mappedData = [
                        'id'              => $newUlid,
                        'date'            => $this->resolveDateTime($record->transaction_date, $record->created_at ?? null),
                        'required_date'   => $this->resolveDateTime($record->transaction_date, $record->created_at ?? null),
                        'external_note'   => $this->buildExternalNote($record),
                        'code'            => $this->buildCode($record),
                        'branch_id'       => $this->resolveDefaultBranchId(),
                        'status'          => $this->mapLegacyStatus($record->is_finish ?? null),
                        'created_by_id'   => $this->resolveCreatedById($record->person_id ?? null),
                        'submitted_at'    => null,
                        'canceled_at'     => null,
                        'revision_number' => 0,
                        'amended_from_id' => null,
                        'additional_data' => [
                            'legacy_id'                => $legacyId,
                            'legacy_reference'         => $record->reference ?? null,
                            'legacy_location_id'       => $record->location_id ?? null,
                            'legacy_breakdown_id'      => $record->breakdown_reference_id ?? null,
                            'legacy_type'              => $record->type ?? null,
                            'legacy_is_finish'         => $record->is_finish ?? null,
                            'legacy_breakdown_arr'     => $record->breakdown_arr ?? null,
                            'legacy_comments_internal' => $record->comments_internal ?? null,
                        ],
                        'deleted_at'      => null,
                        'created_at'      => $record->created_at ?? null,
                        'updated_at'      => $record->updated_at ?? null,
                    ];

                    DB::table($this->targetTable)->updateOrInsert(
                        ['id' => $newUlid],
                        $mappedData,
                    );

                    $this->mapId($this->sourceTable, $legacyId, $newUlid);
                    $this->recordModelLog($this->targetModel, $newUlid, $mappedData);
                }
            });

        $this->log("Migrasi {$this->sourceTable} selesai.");
    }

    /**
     * @return array<int, FormStatus>
     */
    protected function mapLegacyStatus(mixed $legacyStatus): array {
        // TODO: sesuaikan mapping status legacy requisition ke status ERP.
        return $this->defaultLegacyStatus();
    }

    protected function buildCode(object $record): string {
        $reference = $this->nullableString($record->reference);
        if ($reference !== null) {
            return $reference;
        }

        $legacyId = (string) $record->{$this->sourcePrimaryKey};
        $year     = $this->extractShortYear($record->created_at ?? $record->transaction_date ?? null);

        return "PR-{$legacyId}/{$year}";
    }

    protected function buildExternalNote(object $record): ?string {
        $note     = $this->nullableString($record->note);
        $internal = $this->nullableString($record->comments_internal);

        if ($note !== null && $internal !== null) {
            return "{$note}\n\n[Internal] {$internal}";
        }

        return $note ?? $internal;
    }

    protected function resolveDateTime(mixed $primaryDate, mixed $fallbackDate = null): string {
        $resolved = $this->nullableString($primaryDate)
            ?? $this->nullableString($fallbackDate)
            ?? now()->toDateTimeString();

        return $resolved;
    }

    protected function nullableString(mixed $value): ?string {
        $stringValue = trim((string) ($value ?? ''));

        return $stringValue === '' ? null : $stringValue;
    }

    protected function extractShortYear(mixed $date): string {
        $timestamp = strtotime((string) ($date ?? ''));

        return $timestamp ? date('y', $timestamp) : date('y');
    }
}
