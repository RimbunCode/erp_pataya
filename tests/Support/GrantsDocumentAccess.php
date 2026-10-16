<?php

namespace Tests\Support;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetService;
use App\Models\User\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Helper test untuk menyiapkan permission berbasis role di DB (role_permissions),
 * memakai AssetService sebagai model dokumen (tidak mengabaikan permission, beda dengan
 * Ticket). Dipakai test mention comment.
 */
trait GrantsDocumentAccess {
    private string $documentPermissionId;

    /**
     * Dokumen uji: AssetService punya kolom created_by_id dan tidak mengabaikan permission
     * (Todo/Ticket mengabaikannya, Todo juga tak punya created_by_id).
     */
    protected function makeDocument(?string $creatorId = null): AssetService {
        return AssetService::factory()->create([
            'asset_id'      => Asset::factory()->create()->id,
            'created_by_id' => $creatorId ?? User::factory()->create()->id,
        ]);
    }

    protected function prepareDocumentPermission(): void {
        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        $this->documentPermissionId = (string) Str::ulid();
        DB::table('permissions')->insert([
            'id'                 => $this->documentPermissionId,
            'module'             => 'test',
            'name'               => 'AssetService',
            'model'              => AssetService::class,
            'route'              => 'test',
            'permissions'        => '[]',
            'is_submitable'      => 0,
            'allow_only_creator' => 1,
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);
    }

    /**
     * Beri `$user` sebuah role dengan satu entry permission pada AssetService.
     *
     * @param  array<string, bool>  $flags
     */
    protected function grantDocumentAccess(User $user, bool $onlyCreator = false, array $flags = ['select' => true, 'read' => true], bool $roleDisabled = false, int $level = 0): void {
        $roleId = (string) Str::ulid();
        DB::table('roles')->insert([
            'id'          => $roleId,
            'name'        => 'Role ' . $roleId,
            'description' => '',
            'is_disabled' => $roleDisabled ? 1 : 0,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);
        DB::table('user_role')->insert([
            'user_id'    => $user->id,
            'role_id'    => $roleId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('role_permissions')->insert([
            'id'            => (string) Str::ulid(),
            'permission_id' => $this->documentPermissionId,
            'module'        => 'test',
            'name'          => 'AssetService',
            'model'         => AssetService::class,
            'role_id'       => $roleId,
            'level'         => $level,
            'only_creator'  => $onlyCreator ? 1 : 0,
            'is_submitable' => 0,
            'permissions'   => json_encode($flags),
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);
    }

    /**
     * Permission untuk session aktor (yang menulis comment), dalam bentuk hasil
     * AppMiddleware::resolvePermissions.
     *
     * @return array<string, mixed>
     */
    protected function actorSession(): array {
        $full = fn (string $model, array $flags) => [
            0 => [[
                'model'        => $model,
                'level'        => 0,
                'only_creator' => false,
                'permissions'  => $flags,
            ]],
        ];

        return [
            'permissions' => [
                AssetService::class => $full(AssetService::class, ['select' => true, 'read' => true, 'write' => true]),
                User::class         => $full(User::class, ['select' => true, 'read' => true]),
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    /**
     * @return array<string, mixed> dokumen ProseMirror minimal berisi node mention
     */
    protected function mentionJson(string ...$userIds): array {
        return [
            'type'    => 'doc',
            'content' => [[
                'type'    => 'paragraph',
                'content' => array_map(fn (string $id) => [
                    'type'  => 'mention',
                    'attrs' => ['id' => $id, 'label' => 'Someone'],
                ], $userIds),
            ]],
        ];
    }
}
