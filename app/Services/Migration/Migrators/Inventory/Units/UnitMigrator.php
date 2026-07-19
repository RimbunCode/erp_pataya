<?php

namespace App\Services\Migration\Migrators\Inventory\Units;

use App\Models\Inventory\Unit;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class UnitMigrator extends BaseMigrator {
    /**
     * Nama tabel sumber di database legacy.
     */
    protected string $sourceTable = 'item_unit';

    /**
     * Model tujuan untuk pencatatan Log.
     */
    protected string $targetModel = Unit::class;

    /**
     * Execute the migration logic.
     */
    public function migrate(): void {
        $this->log("Memulai migrasi untuk tabel: {$this->sourceTable}");

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy('id')
            ->chunk(500, function ($records) {
                foreach ($records as $record) {
                    $mappedData = $this->transform((array) $record, [
                        'code'              => 'abbr',
                        'name'              => 'name',
                        'conversion_factor' => fn () => 1,
                        'is_default'        => fn () => false,
                    ]);

                    $newUlid                  = (string) Str::ulid();
                    $mappedData['id']         = $newUlid;
                    $mappedData['created_at'] = $record->created_at ?? now();
                    $mappedData['updated_at'] = $record->updated_at ?? now();

                    DB::table('units')->updateOrInsert(['id' => $newUlid], $mappedData);

                    $this->mapId($this->sourceTable, $record->id, $newUlid);

                    $this->recordModelLog($this->targetModel, $newUlid, $mappedData);
                }

                $this->log('Berhasil memproses ' . count($records) . ' baris...');
            });

        $this->log("Migrasi {$this->sourceTable} selesai sepenuhnya.");
    }
}
