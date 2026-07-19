<?php

namespace App\Services\Migration\Migrators\User\Authentication;

use App\Enums\FormStatus;
use App\Models\User\User;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class UserMigrator extends BaseMigrator {
    /**
     * Nama tabel sumber di database legacy.
     */
    protected string $sourceTable = 'users';

    /**
     * Model tujuan untuk pencatatan Log.
     */
    protected string $targetModel = User::class;

    /**
     * Username legacy yang sudah dipakai pada proses migrasi ini (mencegah tabrakan unique).
     *
     * @var array<string, true>
     */
    protected array $usedUsernames = [];

    /**
     * Execute the migration logic.
     */
    public function migrate(): void {
        $this->log("Memulai migrasi untuk tabel: {$this->sourceTable}");

        $defaultBranchId = $this->resolveDefaultBranchId();

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy('id')
            ->chunk(500, function ($records) use ($defaultBranchId) {
                foreach ($records as $record) {
                    $mappedData = $this->transform((array) $record, [
                        'name'     => 'real_name',
                        'username' => function ($row) {
                            return $this->uniqueUsername((string) $row['user_id']);
                        },
                        'email'    => 'email',
                        'password' => 'password',
                        'phone'    => fn ($row) => $row['phone'] !== '' ? $row['phone'] : null,
                        'status'   => fn ($row) => ((int) $row['inactive'] === 1)
                            ? FormStatus::INACTIVE->value
                            : FormStatus::ACTIVE->value,
                        'default_branch_id' => fn () => $defaultBranchId,
                    ]);

                    $newUlid                         = (string) Str::ulid();
                    $mappedData['id']                = $newUlid;
                    $mappedData['email_verified_at'] = now();
                    $mappedData['created_at']        = $record->created_at ?? now();
                    $mappedData['updated_at']        = $record->updated_at ?? now();

                    DB::table('users')->updateOrInsert(['id' => $newUlid], $mappedData);

                    $this->mapId($this->sourceTable, $record->id, $newUlid);

                    $this->recordModelLog($this->targetModel, $newUlid, $mappedData);
                }

                $this->log('Berhasil memproses ' . count($records) . ' baris...');
            });

        $this->log("Migrasi {$this->sourceTable} selesai sepenuhnya.");
    }

    /**
     * Pastikan username unik meski data legacy punya duplikat user_id.
     */
    protected function uniqueUsername(string $username): string {
        $candidate = $username;
        $suffix    = 1;

        while (isset($this->usedUsernames[$candidate]) || DB::table('users')->where('username', $candidate)->exists()) {
            $candidate = $username . '-' . (++$suffix);
        }

        $this->usedUsernames[$candidate] = true;

        return $candidate;
    }
}
