<?php

namespace App\Services\Migration\Migrators\User\Roles;

use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;

class UserRoleMigrator extends BaseMigrator {
    /**
     * Nama tabel sumber di database legacy.
     */
    protected string $sourceTable = 'role_user';

    /**
     * Execute the migration logic.
     */
    public function migrate(): void {
        $this->log("Memulai migrasi untuk tabel: {$this->sourceTable}");

        $processed = 0;
        $skipped   = 0;

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy('user_id')
            ->chunk(500, function ($records) use (&$processed, &$skipped) {
                foreach ($records as $record) {
                    $userUlid = $this->getNewId('users', $record->user_id);
                    $roleUlid = $this->getNewId('roles', $record->role_id);

                    if ($userUlid === null || $roleUlid === null) {
                        $this->log("Baris role_user (user_id={$record->user_id}, role_id={$record->role_id}) dilewati: user atau role belum termigrasi.", 'warning');
                        $skipped++;

                        continue;
                    }

                    DB::table('user_role')->updateOrInsert([
                        'user_id' => $userUlid,
                        'role_id' => $roleUlid,
                    ], [
                        'user_id'    => $userUlid,
                        'role_id'    => $roleUlid,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    $processed++;
                }

                $this->log('Berhasil memproses ' . count($records) . ' baris...');
            });

        $this->log("Migrasi {$this->sourceTable} selesai. Dipetakan: {$processed}, dilewati: {$skipped}.");
    }
}
