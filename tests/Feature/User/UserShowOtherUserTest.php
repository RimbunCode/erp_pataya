<?php

namespace Tests\Feature\User;

use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class UserShowOtherUserTest extends TestCase {
    use RefreshDatabase;

    private User $authUser;

    /** @var array<string, mixed> */
    private array $sessionData;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        $this->authUser = User::factory()->create();

        $this->sessionData = [
            'permissions' => [
                User::class => [
                    0 => [
                        [
                            'model'        => User::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => [
                                'select' => true,
                                'read'   => true,
                                'write'  => true,
                                'create' => true,
                                'delete' => true,
                            ],
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    public function test_show_returns_target_user_not_authenticated_user(): void {
        $otherUser = User::factory()->create();

        $response = $this
            ->withSession($this->sessionData)
            ->withCookie('lang', 'en')
            ->actingAs($this->authUser)
            ->get(route('users.show', $otherUser));

        $response->assertOk();

        preg_match('#<script[^>]*type="application/json">(.*?)</script>#s', $response->getContent(), $matches);
        $page = json_decode($matches[1], true);

        $this->assertSame($otherUser->id, $page['props']['user']['id']);
    }
}
