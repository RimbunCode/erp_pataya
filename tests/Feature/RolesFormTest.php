<?php

namespace Tests\Feature;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RolesFormTest extends TestCase
{
    use RefreshDatabase;

    public function test_roles_create_page_is_displayed(): void
    {
        $user = User::factory()->create();
        $permissions = [
            Role::class => [
                0 => [
                    'false' => [
                        'model' => Role::class,
                        'level' => 0,
                        'only_creator' => false,
                        'permissions' => [
                            'create' => true,
                        ],
                    ],
                ],
            ],
        ];

        $response = $this
            ->actingAs($user)
            ->withSession(['permissions' => $permissions])
            ->withoutMiddleware([AppMiddleware::class, LanguageMiddleware::class])
            ->get('/roles/create');

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page->component('Users/Roles/Show'));
    }
}
