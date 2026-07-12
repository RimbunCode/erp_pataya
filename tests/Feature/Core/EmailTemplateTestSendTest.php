<?php

namespace Tests\Feature\Core;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Jobs\SendEmailNotificationJob;
use App\Models\Core\EmailTemplate;
use App\Models\Model;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class EmailTemplateTestSendTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        foreach (['users', 'email_templates'] as $table) {
            if (Schema::hasTable($table) && ! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        Schema::create('test_send_documents', function ($t) {
            $t->ulid('id')->primary();
            $t->string('number')->nullable();
            $t->boolean('is_example')->default(false);
            $t->timestamps();
        });
    }

    private function makeUser(): User {
        return User::factory()->create();
    }

    private function permissions(): array {
        return [
            'permissions' => [
                EmailTemplate::class => [
                    0 => [
                        [
                            'model'        => EmailTemplate::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => ['select' => true, 'read' => true, 'write' => true, 'create' => true, 'delete' => true],
                        ],
                    ],
                ],
            ],
        ];
    }

    public function test_test_send_dispatches_job_to_logged_in_user(): void {
        Queue::fake();

        TestSendDocument::create(['number' => 'SO-999', 'is_example' => true]);

        $emailTemplate = EmailTemplate::factory()->create([
            'model'     => TestSendDocument::class,
            'subject'   => 'Order {{ $doc->number }}',
            'body_html' => '<p>Nomor: {{ $doc->number }}</p>',
        ]);

        $user = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('emailTemplates.testSend', $emailTemplate))
            ->assertRedirect();

        Queue::assertPushed(SendEmailNotificationJob::class);
    }

    public function test_test_send_without_model_shows_error(): void {
        $emailTemplate = EmailTemplate::factory()->create(['model' => null]);
        $user          = $this->makeUser();

        $response = $this->actingAs($user)
            ->withSession($this->permissions())
            ->post(route('emailTemplates.testSend', $emailTemplate));

        $response->assertRedirect();
        $response->assertSessionHas('alert');
    }

    public function test_test_send_without_example_data_shows_error(): void {
        $emailTemplate = EmailTemplate::factory()->create(['model' => TestSendDocument::class]);
        $user          = $this->makeUser();

        $response = $this->actingAs($user)
            ->withSession($this->permissions())
            ->post(route('emailTemplates.testSend', $emailTemplate));

        $response->assertRedirect();
        $response->assertSessionHas('alert');
    }

    public function test_test_send_requires_existing_template(): void {
        $user = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('emailTemplates.testSend', 'not-a-real-id'))
            ->assertNotFound();
    }
}

class TestSendDocument extends Model {
    use DataTable, \Illuminate\Database\Eloquent\Concerns\HasUlids;

    protected $table            = 'test_send_documents';
    protected $guarded          = ['id'];
    public string $translateKey = 'test.testSendDocument';
}
