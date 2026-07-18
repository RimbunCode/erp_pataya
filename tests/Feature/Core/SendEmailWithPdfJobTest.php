<?php

namespace Tests\Feature\Core;

use App\Jobs\Core\SendEmailWithPdfJob;
use App\Models\Core\File;
use App\Models\Core\Fileable;
use App\Models\Core\PrintTemplate;
use App\Models\Model as AppModel;
use App\Notifications\AnonymousEmailNotifiable;
use App\Notifications\EmailTemplateSendNotification;
use App\Services\Core\PrintTemplate\PdfAttachmentService;
use App\Services\Core\PrintTemplate\PdfExportService;
use App\Services\Core\PrintTemplate\PrintTemplateRenderService;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class SendEmailPdfJobTestDocument extends AppModel {
    use DataTable, HasUlids;

    protected $table            = 'send_email_pdf_test_documents';
    protected $guarded          = ['id'];
    public string $translateKey = 'test.sendEmailPdfTestDocument';
}

class SendEmailWithPdfJobTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('send_email_pdf_test_documents')) {
            Schema::create('send_email_pdf_test_documents', function ($table): void {
                $table->ulid('id')->primary();
                $table->string('code')->nullable();
                $table->boolean('is_example')->default(false);
                $table->softDeletes();
                $table->timestamps();
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
                $table->text('value');
                $table->boolean('is_example')->default(false);
                $table->timestamps();
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

        // Paksa fallback ke dompdf pure-PHP (binary wkhtmltopdf sengaja tidak ada).
        config(['pdf.wkhtmltopdf_binary' => storage_path('app/bin/does-not-exist-binary')]);

        Notification::fake();
    }

    private function createDocument(array $overrides = []): SendEmailPdfJobTestDocument {
        $id   = (string) Str::ulid();
        $data = array_merge([
            'id'         => $id,
            'code'       => 'DOC-001',
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides);

        DB::table('send_email_pdf_test_documents')->insert($data);

        return SendEmailPdfJobTestDocument::find($id);
    }

    private function makeJob(SendEmailPdfJobTestDocument $document, bool $includePdf, ?string $fromName = null): SendEmailWithPdfJob {
        return new SendEmailWithPdfJob(
            SendEmailPdfJobTestDocument::class,
            $document->id,
            'customer@example.com',
            [],
            [],
            'Subject',
            '<p>Body</p>',
            [],
            $includePdf,
            $fromName,
        );
    }

    public function test_sends_without_touching_pdf_infrastructure_when_include_pdf_is_false(): void {
        $document = $this->createDocument();

        $this->makeJob($document, false)->handle(
            app(PrintTemplateRenderService::class),
            app(PdfExportService::class),
            app(PdfAttachmentService::class),
        );

        $this->assertSame(0, Fileable::count());
        Notification::assertSentTo(new AnonymousEmailNotifiable('customer@example.com'), EmailTemplateSendNotification::class);
    }

    public function test_uses_existing_generated_pdf_without_regenerating(): void {
        $document = $this->createDocument();

        $file = File::create([
            'name'      => 'existing',
            'path'      => 'files/existing.pdf',
            'extension' => 'pdf',
            'mime_type' => 'application/pdf',
            'is_public' => false,
        ]);
        Fileable::create([
            'fileable_id'      => $document->id,
            'fileable_type'    => SendEmailPdfJobTestDocument::class,
            'file_id'          => $file->id,
            'is_generated_pdf' => true,
        ]);

        $this->makeJob($document, true)->handle(
            app(PrintTemplateRenderService::class),
            app(PdfExportService::class),
            app(PdfAttachmentService::class),
        );

        // Tidak ada Fileable BARU tercipta — hanya yang sudah ada dipakai.
        $this->assertSame(1, Fileable::count());
        Notification::assertSentTo(new AnonymousEmailNotifiable('customer@example.com'), EmailTemplateSendNotification::class);
    }

    public function test_generates_new_pdf_when_none_exists_but_default_template_available(): void {
        $document = $this->createDocument();

        PrintTemplate::create([
            'name'       => 'Default',
            'model'      => SendEmailPdfJobTestDocument::class,
            'name_model' => 'SendEmailPdfJobTestDocument',
            'is_default' => true,
            'html'       => '<p>Halo</p>',
        ]);

        $this->makeJob($document, true)->handle(
            app(PrintTemplateRenderService::class),
            app(PdfExportService::class),
            app(PdfAttachmentService::class),
        );

        $fileable = Fileable::where('fileable_id', $document->id)
            ->where('fileable_type', SendEmailPdfJobTestDocument::class)
            ->first();

        $this->assertNotNull($fileable);
        $this->assertTrue($fileable->is_generated_pdf);
        Notification::assertSentTo(new AnonymousEmailNotifiable('customer@example.com'), EmailTemplateSendNotification::class);
    }

    public function test_throws_and_does_not_send_when_no_default_template_available(): void {
        $document = $this->createDocument();

        $this->expectException(ModelNotFoundException::class);

        try {
            $this->makeJob($document, true)->handle(
                app(PrintTemplateRenderService::class),
                app(PdfExportService::class),
                app(PdfAttachmentService::class),
            );
        } finally {
            $this->assertSame(0, Fileable::count());
            Notification::assertNothingSent();
        }
    }

    public function test_throws_and_does_not_send_when_render_fails(): void {
        $document = $this->createDocument();

        PrintTemplate::create([
            'name'       => 'Default',
            'model'      => SendEmailPdfJobTestDocument::class,
            'name_model' => 'SendEmailPdfJobTestDocument',
            'is_default' => true,
            'html'       => '<p>Halo</p>',
        ]);

        $failingRenderService = Mockery::mock(PrintTemplateRenderService::class);
        $failingRenderService->shouldReceive('render')->andThrow(new RuntimeException('render gagal'));

        $this->expectException(RuntimeException::class);

        try {
            $this->makeJob($document, true)->handle(
                $failingRenderService,
                app(PdfExportService::class),
                app(PdfAttachmentService::class),
            );
        } finally {
            $this->assertSame(0, Fileable::count());
            Notification::assertNothingSent();
        }
    }

    public function test_from_name_is_passed_through_and_from_address_stays_config_value(): void {
        $document = $this->createDocument();

        $this->makeJob($document, false, 'Sales Team')->handle(
            app(PrintTemplateRenderService::class),
            app(PdfExportService::class),
            app(PdfAttachmentService::class),
        );

        Notification::assertSentTo(
            new AnonymousEmailNotifiable('customer@example.com'),
            function (EmailTemplateSendNotification $notification, array $channels, $notifiable) {
                $mail = $notification->toMail($notifiable);

                return $mail->from[1] === 'Sales Team' && $mail->from[0] === config('mail.from.address');
            },
        );
    }
}
