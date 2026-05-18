<?php

namespace App\Services\Migration\Migrators\User\Authentication;

use App\Models\User\User;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserMigrator extends BaseMigrator {
    protected string $sourceTable      = 'users';
    protected string $sourcePrimaryKey = 'id';
    protected string $targetTable      = 'users';
    protected string $targetModel      = User::class;

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable}");

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $existingId = $this->getNewId($this->sourceTable, $record->{$this->sourcePrimaryKey});
                    $newUlid    = $existingId ?? (string) Str::ulid();

                    $username = Str::snake($this->nullableString($record->user_id));
                    $name     = $this->nullableString($record->real_name) ?? $username;
                    $email    = $this->resolveEmail($record, $newUlid);

                    $mappedData = [
                        'id'                => $newUlid,
                        'name'              => $name,
                        'username'          => $username,
                        'email'             => $email,
                        'email_verified_at' => null,
                        'password'          => $this->normalizePassword($record->password),
                        'image'             => $this->nullableString($record->picture),
                        'avatar_url'        => null,
                        'status'            => ((int) ($record->inactive ?? 0)) === 1 ? 'inactive' : 'active',
                        'gender'            => null,
                        'birthdate'         => null,
                        'phone'             => $this->nullableString($record->phone),
                        'remember_token'    => $this->nullableString($record->remember_token),
                        'default_branch_id' => null,
                        'have_transactions' => false,
                        'created_at'        => $record->created_at,
                        'updated_at'        => $record->updated_at,
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

    protected function resolveEmail(object $record, string $targetId): string {
        $legacyEmail = $this->nullableString($record->email);
        if ($legacyEmail !== null) {
            return $this->ensureUniqueEmail($legacyEmail, $targetId, (string) $record->{$this->sourcePrimaryKey});
        }

        $username = $this->nullableString($record->user_id) ?? "user{$record->{$this->sourcePrimaryKey} }";

        return $this->ensureUniqueEmail("{$username}@legacy.local", $targetId, (string) $record->{$this->sourcePrimaryKey});
    }

    protected function ensureUniqueEmail(string $email, string $targetId, string $legacyId): string {
        $alreadyUsed = DB::table($this->targetTable)
            ->where('email', $email)
            ->where('id', '!=', $targetId)
            ->exists();

        if (! $alreadyUsed) {
            return $email;
        }

        [$localPart, $domain] = array_pad(explode('@', $email, 2), 2, 'legacy.local');

        return "{$localPart}+legacy{$legacyId}@{$domain}";
    }

    protected function normalizePassword(mixed $password): string {
        $passwordString = (string) ($password ?? '');

        if ($passwordString === '') {
            return Hash::make(Str::random(32));
        }

        $isLaravelHash = Str::startsWith($passwordString, ['$2y$', '$2a$', '$argon2i$', '$argon2id$']);

        return $isLaravelHash ? $passwordString : Hash::make($passwordString);
    }

    protected function nullableString(mixed $value): ?string {
        $stringValue = trim((string) ($value ?? ''));

        return $stringValue === '' ? null : $stringValue;
    }
}
