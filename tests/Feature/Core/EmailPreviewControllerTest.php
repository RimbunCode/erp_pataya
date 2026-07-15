<?php

namespace Tests\Feature\Core;

use App\Http\Controllers\Controller;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\EmailTemplate;
use App\Models\Core\File;
use App\Models\Core\Fileable;
use App\Models\Core\PrintTemplate;
use App\Models\Model as AppModel;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Stub dokumen submitable minimal, tanpa relasi kompleks (khusus untuk
 * menguji emailPreview/sendEmail secara terisolasi tanpa membawa
 * kompleksitas model produksi seperti SalesOrder::items dll).
 */
class EmailPreviewTestDocument extends AppModel {
    use DataTable, HasUlids;

    protected $table            = 'email_preview_test_documents';
    protected $guarded          = ['id'];
    public string $translateKey = 'test.emailPreviewTestDocument';
}

class EmailPreviewTestDocumentController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, EmailPreviewTestDocument::class);
    }
}

class EmailPreviewControllerTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        if (! Schema::hasTable('email_templates')) {
            Schema::create('email_templates', function ($table): void {
                $table->char('id', 26)->primary();
                $table->string('name');
                $table->char('permission_id', 26)->nullable();
                $table->string('model')->nullable();
                $table->string('name_model')->nullable();
                $table->boolean('is_default')->default(false);
                $table->string('subject');
                $table->longText('body_html');
                $table->json('body_json')->nullable();
                $table->string('default_language')->nullable();
                $table->string('recipient_path')->nullable();
                $table->boolean('is_example')->default(false);
                $table->timestamps();
                $table->softDeletes();
            });
        }

        // Skema identik dengan definisi paling lengkap yang dipakai file test
        // lain (mis. ControllerPrintPreferencesDocInfoTest) — tabel print_templates
        // di-share SQLite in-memory antar file test dalam satu proses run, jadi
        // skema di sini HARUS superset/identik agar tidak ada file yang membuat
        // versi "kurang lengkap" duluan dan membuat file lain kehilangan kolom.
        if (! Schema::hasTable('print_templates')) {
            Schema::create('print_templates', function ($table): void {
                $table->char('id', 26)->primary();
                $table->string('name');
                $table->char('permission_id', 26)->nullable();
                $table->boolean('is_letter_head')->default(false);
                $table->char('letter_head_id', 26)->nullable();
                $table->string('name_model')->nullable();
                $table->string('model')->nullable();
                $table->longText('html')->nullable();
                $table->longText('css')->nullable();
                $table->json('template')->nullable();
                $table->json('used_relations')->nullable();
                $table->boolean('is_default')->default(false);
                $table->boolean('is_example')->default(false);
                $table->string('default_language')->nullable();
                $table->string('font_family')->nullable();
                $table->string('paper')->nullable();
                $table->string('page_number')->nullable();
                $table->string('orientation')->default('portrait');
                $table->double('width')->nullable();
                $table->double('height')->nullable();
                $table->double('margin_top')->nullable();
                $table->double('margin_bottom')->nullable();
                $table->double('margin_left')->nullable();
                $table->double('margin_right')->nullable();
                $table->boolean('show_absolute_values')->default(false);
                $table->string('unit')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('email_preview_test_documents')) {
            Schema::create('email_preview_test_documents', function ($table): void {
                $table->ulid('id')->primary();
                $table->string('code')->nullable();
                $table->char('customer_id', 26)->nullable();
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

        if (! Schema::hasTable('files')) {
            Schema::create('files', function ($table): void {
                $table->ulid('id')->primary();
                $table->string('name');
                $table->text('path')->nullable();
                $table->string('extension')->nullable();
                $table->string('mime_type');
                $table->boolean('is_public')->default(false);
                $table->boolean('is_draft')->default(false);
                $table->boolean('is_example')->default(false);
                $table->char('created_by_id', 26)->nullable();
                $table->integer('lft')->nullable();
                $table->integer('rgt')->nullable();
                $table->integer('depth')->nullable();
                $table->char('parent_id', 26)->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('fileables')) {
            Schema::create('fileables', function ($table): void {
                $table->char('file_id', 26);
                $table->ulidMorphs('fileable');
                $table->boolean('is_generated_pdf')->default(false);
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('preferences')) {
            Schema::create('preferences', function ($table): void {
                $table->string('key')->primary();
                $table->json('value')->nullable();
                $table->boolean('is_example')->default(false);
                $table->timestamps();
            });
        }

        Route::middleware('web')->group(function () {
            Route::get('/_test/email-preview-doc/{id}/email/{emailTemplate?}', [EmailPreviewTestDocumentController::class, 'emailPreview'])
                ->name('_test.emailPreviewDoc.email.preview');
        });
        $this->app['router']->getRoutes()->refreshNameLookups();
    }

    private function createDocument(array $overrides = []): EmailPreviewTestDocument {
        $id   = (string) Str::ulid();
        $data = array_merge([
            'id'         => $id,
            'code'       => 'DOC-001',
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides);

        DB::table('email_preview_test_documents')->insert($data);

        return EmailPreviewTestDocument::find($id);
    }

    private function makePermissions(bool $canPrint = true): array {
        return [
            EmailPreviewTestDocument::class => [
                0 => [
                    [
                        'model'        => EmailPreviewTestDocument::class,
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

    public function test_preview_without_email_template_returns_empty_subject_and_body(): void {
        $user     = User::factory()->create();
        $document = $this->createDocument();

        $response = $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions()])
            ->getJson(route('_test.emailPreviewDoc.email.preview', ['id' => $document->id]));

        $response->assertOk();
        $response->assertJson(['subject' => '', 'body' => '', 'recipient' => null]);
    }

    public function test_preview_with_email_template_compiles_subject_and_body(): void {
        $user          = User::factory()->create();
        $document      = $this->createDocument(['code' => 'DOC-777']);
        $emailTemplate = EmailTemplate::create([
            'name'       => 'Notif Doc',
            'model'      => EmailPreviewTestDocument::class,
            'name_model' => 'EmailPreviewTestDocument',
            'subject'    => 'Order {{ $doc->code }}',
            'body_html'  => '<p>Kode: {{ $doc->code }}</p>',
            'is_default' => true,
        ]);

        $response = $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions()])
            ->getJson(route('_test.emailPreviewDoc.email.preview', [
                'id'            => $document->id,
                'emailTemplate' => $emailTemplate->id,
            ]));

        $response->assertOk();
        $response->assertJson([
            'subject' => 'Order DOC-777',
            'body'    => '<p>Kode: DOC-777</p>',
        ]);
    }

    public function test_preview_resolves_recipient_path_safely(): void {
        $user          = User::factory()->create();
        $document      = $this->createDocument();
        $emailTemplate = EmailTemplate::create([
            'name'           => 'Notif Doc',
            'model'          => EmailPreviewTestDocument::class,
            'name_model'     => 'EmailPreviewTestDocument',
            'subject'        => 'Halo',
            'body_html'      => '<p>Halo</p>',
            'is_default'     => true,
            'recipient_path' => 'nonexistent.email',
        ]);

        $response = $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions()])
            ->getJson(route('_test.emailPreviewDoc.email.preview', [
                'id'            => $document->id,
                'emailTemplate' => $emailTemplate->id,
            ]));

        $response->assertOk();
        $response->assertJson(['recipient' => null]);
    }

    public function test_preview_reports_has_generated_pdf_when_fileable_marked(): void {
        $user     = User::factory()->create();
        $document = $this->createDocument();

        $file = File::create([
            'name'      => 'invoice',
            'path'      => 'files/invoice.pdf',
            'extension' => 'pdf',
            'mime_type' => 'application/pdf',
            'is_public' => false,
        ]);
        Fileable::create([
            'fileable_id'      => $document->id,
            'fileable_type'    => EmailPreviewTestDocument::class,
            'file_id'          => $file->id,
            'is_generated_pdf' => true,
        ]);

        $response = $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions()])
            ->getJson(route('_test.emailPreviewDoc.email.preview', ['id' => $document->id]));

        $response->assertOk();
        $response->assertJson(['hasGeneratedPdf' => true, 'canOfferPdf' => true]);
    }

    public function test_preview_offers_pdf_option_when_default_print_template_exists_but_no_pdf_yet(): void {
        $user     = User::factory()->create();
        $document = $this->createDocument();

        PrintTemplate::create([
            'name'       => 'Default Print',
            'model'      => EmailPreviewTestDocument::class,
            'is_default' => true,
        ]);

        $response = $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions()])
            ->getJson(route('_test.emailPreviewDoc.email.preview', ['id' => $document->id]));

        $response->assertOk();
        $response->assertJson(['hasGeneratedPdf' => false, 'canOfferPdf' => true]);
    }

    public function test_preview_does_not_offer_pdf_when_no_default_template_and_no_pdf(): void {
        $user     = User::factory()->create();
        $document = $this->createDocument();

        $response = $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions()])
            ->getJson(route('_test.emailPreviewDoc.email.preview', ['id' => $document->id]));

        $response->assertOk();
        $response->assertJson(['hasGeneratedPdf' => false, 'canOfferPdf' => false]);
    }

    public function test_user_without_print_permission_is_forbidden(): void {
        $user     = User::factory()->create();
        $document = $this->createDocument();

        $response = $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions(canPrint: false)])
            ->getJson(route('_test.emailPreviewDoc.email.preview', ['id' => $document->id]));

        $response->assertForbidden();
    }
}
