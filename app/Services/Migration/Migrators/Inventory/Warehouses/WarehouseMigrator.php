<?php

namespace App\Services\Migration\Migrators\Inventory\Warehouses;

use App\Models\Inventory\Warehouse;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WarehouseMigrator extends BaseMigrator {
    /**
     * Nama tabel sumber di database legacy.
     * `stock_locations` adalah index item x lokasi (PK = stock_id), bukan master lokasi murni —
     * migrator ini mengekstrak nilai `location` yang unik saja.
     */
    protected string $sourceTable = 'stock_locations';

    /**
     * Key mapping ID pada `migration_mappings` untuk lokasi (bukan nama tabel sumber,
     * karena sumbernya bukan baris per-lokasi).
     */
    protected string $mappingKey = 'location';

    /**
     * Model tujuan untuk pencatatan Log.
     */
    protected string $targetModel = Warehouse::class;

    /**
     * Execute the migration logic.
     */
    public function migrate(): void {
        $this->log("Memulai migrasi lokasi unik dari tabel: {$this->sourceTable}");

        $branchId = $this->resolveDefaultBranchId();

        $locations = DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->whereNotNull('location')
            ->where('location', '!=', '')
            ->distinct()
            ->orderBy('location')
            ->pluck('location');

        foreach ($locations as $location) {
            if ($this->getNewId($this->mappingKey, $location) !== null) {
                continue;
            }

            $newUlid = (string) Str::ulid();

            DB::table('warehouses')->updateOrInsert(['id' => $newUlid], [
                'id'         => $newUlid,
                'branch_id'  => $branchId,
                'name'       => $location,
                'code'       => Str::slug($location),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->mapId($this->mappingKey, $location, $newUlid);

            $this->recordModelLog($this->targetModel, $newUlid, ['name' => $location, 'code' => Str::slug($location)]);
        }

        $this->log('Berhasil memproses ' . $locations->count() . ' lokasi unik.');
    }
}
