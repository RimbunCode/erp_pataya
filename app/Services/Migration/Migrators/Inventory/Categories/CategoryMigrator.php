<?php

namespace App\Services\Migration\Migrators\Inventory\Categories;

use App\Models\Inventory\Category;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CategoryMigrator extends BaseMigrator {
    /**
     * Nama tabel sumber di database legacy.
     */
    protected string $sourceTable = 'stock_category';

    /**
     * Model tujuan untuk pencatatan Log.
     */
    protected string $targetModel = Category::class;

    /**
     * Execute the migration logic.
     */
    public function migrate(): void {
        $this->log("Memulai migrasi untuk tabel: {$this->sourceTable}");

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy('category_id')
            ->chunk(500, function ($records) {
                foreach ($records as $record) {
                    $mappedData = $this->transform((array) $record, [
                        'name' => 'description',
                        'type' => function ($row) {
                            return match (true) {
                                (bool) $row['is_vehicles'] => 'vehicle',
                                (bool) $row['is_services'] => 'service',
                                default                    => 'inventory',
                            };
                        },
                        'default_unit_id' => function ($row) {
                            return $this->getNewId('item_unit', $row['dflt_units']);
                        },
                    ]);

                    $newUlid                  = (string) Str::ulid();
                    $mappedData['id']         = $newUlid;
                    $mappedData['created_at'] = $record->created_at ?? now();
                    $mappedData['updated_at'] = $record->updated_at ?? now();

                    DB::table('categories')->updateOrInsert(['id' => $newUlid], $mappedData);

                    $this->mapId($this->sourceTable, $record->category_id, $newUlid);

                    $this->recordModelLog($this->targetModel, $newUlid, $mappedData);
                }

                $this->log('Berhasil memproses ' . count($records) . ' baris...');
            });

        $this->log("Migrasi {$this->sourceTable} selesai sepenuhnya.");
    }
}
