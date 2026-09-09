<?php

namespace Tests\Feature\User;

use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Regresi untuk bug: GET /users 500 BadMethodCallException
 * "Call to undefined method App\Models\User\User::getDefaultSortColumn()".
 *
 * Root cause: getDefaultSortColumn() sebelumnya hanya didefinisikan di base
 * class App\Models\Model, sedangkan User extends Illuminate\Foundation\Auth\User
 * (wajib untuk Authenticatable) -- satu-satunya model di codebase yang tidak
 * extends App\Models\Model, walau tetap pakai trait DataTable yang men-trigger
 * DataTableScope::addDataTable() (memanggil getDefaultSortColumn()). Fix:
 * method dipindah ke trait App\Traits\DataTable sendiri, titik integrasi asli
 * yang dipakai semua model dengan scope ini, terlepas dari base class-nya.
 */
class UserIndexDataTableTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
    }

    public function test_users_index_page_loads_without_default_sort_column_error(): void {
        $authUser = User::factory()->create();

        $response = $this
            ->withSession([
                'permissions' => [
                    User::class => [
                        0 => [[
                            'model'        => User::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => ['select' => true],
                        ]],
                    ],
                ],
                'permissions_version' => '0|0|0|0',
                'currentBranch'       => null,
            ])
            ->withCookie('lang', 'en')
            ->actingAs($authUser)
            ->get(route('users.index'));

        $response->assertOk();
    }
}
