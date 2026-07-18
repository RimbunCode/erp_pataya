<?php

namespace Tests\Feature\Core;

use App\Http\Controllers\Controller;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Jobs\Core\SendEmailWithPdfJob;
use App\Models\Model as AppModel;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class EmailSendTestDocument extends AppModel {
    use DataTable, HasUlids;

    protected $table            = 'email_send_test_documents';
    protected $guarded          = ['id'];
    public string $translateKey = 'test.emailSendTestDocument';
}

class EmailSendTestDocumentController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, EmailSendTestDocument::class);
    }
}

class EmailTemplateSendControllerTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        if (! Schema::hasTable('email_send_test_documents')) {
            Schema::create('email_send_test_documents', function ($table): void {
                $table->ulid('id')->primary();
                $table->string('code')->nullable();
                $table->boolean('is_example')->default(false);
                $table->softDeletes();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('users')) {
            Schema::create('users', function ($table): void {
                $table->char('id', 26)->primary();
                $table->string('name');
                $table->string('username')->nullable();
                $table->string('email')->unique();
                $table->timestamp('email_verified_at')->nullable();
                $table->string('password')->nullable();
                $table->string('remember_token', 100)->nullable();
                $table->string('status')->default('pending');
                $table->string('image')->nullable();
                $table->char('default_branch_id', 26)->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('permissions')) {
            Schema::create('permissions', function ($table): void {
                $table->char('id', 26)->primary();
                $table->string('name');
                $table->string('model')->nullable();
                $table->string('module')->nullable();
                $table->json('permissions')->nullable();
                $table->boolean('is_submitable')->default(false);
                $table->boolean('allow_only_creator')->default(false);
                $table->timestamps();
                $table->softDeletes();
            });
        }

        Route::middleware('web')->group(function () {
            Route::post('/_test/email-send-doc/{id}/email', [EmailSendTestDocumentController::class, 'sendEmail'])
                ->name('_test.emailSendDoc.email.send');
        });
        $this->app['router']->getRoutes()->refreshNameLookups();
    }

    private function createDocument(array $overrides = []): EmailSendTestDocument {
        $id   = (string) Str::ulid();
        $data = array_merge([
            'id'         => $id,
            'code'       => 'DOC-001',
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides);

        DB::table('email_send_test_documents')->insert($data);

        return EmailSendTestDocument::find($id);
    }

    private function makePermissions(bool $canPrint = true): array {
        return [
            EmailSendTestDocument::class => [
                0 => [
                    [
                        'model'        => EmailSendTestDocument::class,
                        'level'        => 0,
                        'only_creator' => false,
                        'permissions'  => [
                            'select' => true,
                            'read'   => true,
                            'write'  => true,
                            'create' => true,
                            'delete' => true,
                            'print'  => $canPrint,
                        ],
                    ],
                ],
            ],
        ];
    }

    public function test_send_email_dispatches_job_with_full_payload(): void {
        Queue::fake();
        $user     = User::factory()->create();
        $document = $this->createDocument();

        $response = $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions()])
            ->postJson(route('_test.emailSendDoc.email.send', ['id' => $document->id]), [
                'to'          => 'customer@example.com',
                'cc'          => ['cc@example.com'],
                'bcc'         => ['bcc@example.com'],
                'from_name'   => 'Sales Team',
                'subject'     => 'Order DOC-001',
                'body'        => '<p>Halo</p>',
                'fileIds'     => [],
                'include_pdf' => true,
            ]);

        $response->assertRedirect();

        Queue::assertPushed(SendEmailWithPdfJob::class, function (SendEmailWithPdfJob $job) use ($document) {
            return $job->modelClass === EmailSendTestDocument::class
                && $job->documentId === $document->id
                && $job->to === 'customer@example.com'
                && $job->cc === ['cc@example.com']
                && $job->bcc === ['bcc@example.com']
                && $job->subject === 'Order DOC-001'
                && $job->body === '<p>Halo</p>'
                && $job->includePdf === true
                && $job->fromName === 'Sales Team';
        });
    }

    public function test_send_email_response_indicates_queued_not_sent(): void {
        Queue::fake();
        $user     = User::factory()->create();
        $document = $this->createDocument();

        $response = $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions()])
            ->post(route('_test.emailSendDoc.email.send', ['id' => $document->id]), [
                'to'      => 'customer@example.com',
                'subject' => 'Subject',
                'body'    => '<p>Body</p>',
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');
    }

    public function test_user_without_print_permission_is_forbidden(): void {
        Queue::fake();
        $user     = User::factory()->create();
        $document = $this->createDocument();

        $response = $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions(canPrint: false)])
            ->postJson(route('_test.emailSendDoc.email.send', ['id' => $document->id]), [
                'to'      => 'customer@example.com',
                'subject' => 'Subject',
                'body'    => '<p>Body</p>',
            ]);

        $response->assertForbidden();
        Queue::assertNotPushed(SendEmailWithPdfJob::class);
    }

    public function test_validation_error_prevents_dispatch(): void {
        Queue::fake();
        $user     = User::factory()->create();
        $document = $this->createDocument();

        $response = $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions()])
            ->postJson(route('_test.emailSendDoc.email.send', ['id' => $document->id]), []);

        $response->assertUnprocessable();
        Queue::assertNotPushed(SendEmailWithPdfJob::class);
    }
}
