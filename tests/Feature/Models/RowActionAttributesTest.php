<?php

namespace Tests\Feature\Models;

use App\Enums\FormStatus;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\GlPostingStatus;
use App\Models\Core\Tag;
use App\Models\User\User;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class RowActionAttributesTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
            QueryDetectorMiddleware::class,
        ]);

        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'is_example')) {
            Schema::table('users', fn ($t) => $t->boolean('is_example')->default(false));
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function permissions(): array {
        return [
            'permissions' => [
                GlPostingStatus::class => [
                    0 => [
                        [
                            'model'        => GlPostingStatus::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => ['select' => true, 'read' => true, 'write' => true],
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    private function makeStatus(FormStatus $status): GlPostingStatus {
        return GlPostingStatus::create([
            'referenceable_type' => 'App\Models\Purchase\PurchaseReceipt',
            'referenceable_id'   => (string) Str::ulid(),
            'status'             => $status,
            'retry_count'        => 1,
        ]);
    }

    public function test_get_row_action_attributes_returns_declared_attributes(): void {
        $this->assertSame(['canRetry'], GlPostingStatus::getRowActionAttributes());
    }

    public function test_get_row_action_attributes_is_empty_for_model_without_declaration(): void {
        $this->assertSame([], Tag::getRowActionAttributes());
    }

    public function test_document_column_does_not_link_to_a_nonexistent_gl_status_show_route(): void {
        $column = collect(GlPostingStatus::getColumns(1))->firstWhere('name', 'referenceable');

        $this->assertFalse($column['isLink']);
    }

    public function test_row_action_attribute_is_selected_even_when_its_dependency_column_is_not_visible(): void {
        $failed  = $this->makeStatus(FormStatus::FAILED);
        $pending = $this->makeStatus(FormStatus::PENDING);

        // Cookie kolom visible hanya `retry_count`: `status` TIDAK visible, sehingga
        // tanpa $rowActionAttributes kolom `status` tak ikut SELECT.
        $cookieKey = 'datatable_columns_gl_posting_statuses';
        $user      = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->withSession($this->permissions())
            ->withUnencryptedCookie($cookieKey, json_encode(['retry_count' => ['width' => 100]]))
            ->getJson(route('gl-posting-statuses.index'), ['X-Inertia' => 'true'])
            ->assertOk();

        $rows = collect($response->json('props.data.data'))->keyBy('id');

        $this->assertCount(2, $rows);
        $this->assertTrue($rows[$failed->id]['canRetry']);
        $this->assertFalse($rows[$pending->id]['canRetry']);
    }

    public function test_can_retry_column_is_hidden_in_datatable_columns_metadata(): void {
        $columns = collect(GlPostingStatus::getColumns())->keyBy('name');

        $this->assertTrue($columns['canRetry']['hidden']);
        $this->assertSame(['status'], $columns['canRetry']['dependsOn']);
    }
}
