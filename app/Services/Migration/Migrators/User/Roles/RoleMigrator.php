<?php

namespace App\Services\Migration\Migrators\User\Roles;

use App\Models\User\Role;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RoleMigrator extends BaseMigrator {
    /**
     * Nama tabel sumber di database legacy.
     */
    protected string $sourceTable = 'roles';

    /**
     * Model tujuan untuk pencatatan Log.
     */
    protected string $targetModel = Role::class;

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
                        'name'        => fn ($row) => (string) Str::of($row['name'])->trim()->title(),
                        'description' => fn ($row) => $row['description'] !== '' ? $row['description'] : ($row['display_name'] !== '' ? $row['display_name'] : null),
                        'is_disabled' => fn () => false,
                    ]);

                    $newUlid                  = (string) Str::ulid();
                    $mappedData['id']         = $newUlid;
                    $mappedData['created_at'] = $record->created_at ?? now();
                    $mappedData['updated_at'] = $record->updated_at ?? now();

                    DB::table('roles')->updateOrInsert(['id' => $newUlid], $mappedData);

                    $this->mapId($this->sourceTable, $record->id, $newUlid);

                    $this->recordModelLog($this->targetModel, $newUlid, $mappedData);
                }

                $this->log('Berhasil memproses ' . count($records) . ' baris...');
            });

        $this->log("Migrasi {$this->sourceTable} selesai sepenuhnya.");
    }
}
