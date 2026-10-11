<?php

namespace Tests\Feature\Core;

use App\Enums\FormStatus;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\ApprovalInstanceStep;
use App\Models\Core\File;
use App\Models\Core\PrintTemplate;
use App\Models\Model as AppModel;
use App\Models\User\User;
use App\Services\Core\Approval\SignatureResolverService;
use App\Services\Core\PrintTemplate\PdfExportService;
use App\Services\Core\PrintTemplate\PrintTemplateRenderService;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Model dokumen minimal untuk test ini.
 *
 * Sengaja TIDAK memakai trait Submitable: yang diuji hanya resolusi tanda
 * tangan, dan trait itu membawa FormStatusesCast beserta boot hook yang
 * menuntut penyiapan jauh lebih banyak tanpa menambah apa pun pada
 * pengujian. Relasi `approvalable()` disalin apa adanya dari trait.
 */
class SignatureRenderTestDocument extends AppModel {
    use HasUlids;

    protected $table   = 'signature_render_test_documents';
    protected $guarded = ['id'];
    public $timestamps = false;

    public function approvalable() {
        return $this->morphOne(ApprovalInstance::class, 'document', 'document_type', 'document_id');
    }
}

/**
 * Menguji FR8a: hanya SATU tanda tangan yang tercetak, milik penandatangan
 * final, yaitu approver pada step APPROVED dengan `sequence` terbesar.
 */
class ApprovalSignatureRenderTest extends TestCase {
    use RefreshDatabase;

    private string $schemeId;

    protected function setUp(): void {
        parent::setUp();

        foreach (['approval_instances', 'approval_instance_steps', 'users'] as $tbl) {
            if (Schema::hasTable($tbl) && ! Schema::hasColumn($tbl, 'is_example')) {
                Schema::table($tbl, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        if (! Schema::hasTable('signature_render_test_documents')) {
            Schema::create('signature_render_test_documents', function ($t) {
                $t->ulid('id')->primary();
                $t->ulid('created_by_id')->nullable();
                $t->string('code')->nullable();
                $t->string('status')->default('need_approval');
            });
        }

        if (Schema::hasTable('files')) {
            Schema::table('files', function ($t) {
                foreach (['lft', 'rgt', 'depth'] as $column) {
                    if (! Schema::hasColumn('files', $column)) {
                        $t->integer($column)->nullable();
                    }
                }
                if (! Schema::hasColumn('files', 'is_example')) {
                    $t->boolean('is_example')->default(false);
                }
                if (! Schema::hasColumn('files', 'parent_id')) {
                    $t->char('parent_id', 26)->nullable();
                }
            });
        }

        Storage::fake('local');

        $this->schemeId = $this->makeScheme();
    }

    /**
     * Scheme minimal, semata supaya FK `approval_scheme_id` pada
     * `approval_instances` terpenuhi. Isinya tidak diuji: test ini menyusun
     * step secara langsung, bukan lewat evaluasi scheme.
     */
    private function makeScheme(): string {
        $permissionId = (string) Str::ulid();
        DB::table('permissions')->insert([
            'id'                 => $permissionId,
            'module'             => 'test',
            'name'               => 'SignatureRenderTestDocument',
            'model'              => SignatureRenderTestDocument::class,
            'route'              => 'test',
            'permissions'        => '[]',
            'is_submitable'      => 1,
            'allow_only_creator' => 0,
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);

        $schemeId = (string) Str::ulid();
        DB::table('approval_schemes')->insert([
            'id'            => $schemeId,
            'name'          => 'Signature Render Test ' . Str::random(6),
            'permission_id' => $permissionId,
            'name_model'    => 'SignatureRenderTestDocument',
            'model'         => SignatureRenderTestDocument::class,
            'is_active'     => 1,
            'trigger_on'    => 'submit',
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        return $schemeId;
    }

    private function makeUser(string $name, bool $withSignature = false): User {
        $id = (string) Str::ulid();
        DB::table('users')->insert([
            'id'         => $id,
            'name'       => $name,
            'email'      => $id . '@test.com',
            'password'   => null,
            'status'     => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $user = User::find($id);

        if ($withSignature) {
            $path = 'files/' . $id . '.png';
            Storage::put($path, $this->transparentPngBytes());

            $file = File::create([
                'name'      => "signature-{$id}",
                'path'      => $path,
                'extension' => 'png',
                'mime_type' => 'image/png',
                'is_public' => false,
            ]);

            $user->update(['signature_file_id' => $file->id]);
            $user->refresh();
        }

        return $user;
    }

    private function transparentPngBytes(): string {
        $image = imagecreatetruecolor(20, 10);
        imagealphablending($image, false);
        imagesavealpha($image, true);
        imagefilledrectangle($image, 0, 0, 19, 9, 0x7F000000);
        imagesetpixel($image, 5, 5, 0x00000000);

        ob_start();
        imagepng($image);

        return (string) ob_get_clean();
    }

    private function makeDocument(): SignatureRenderTestDocument {
        return SignatureRenderTestDocument::create([
            'id'     => (string) Str::ulid(),
            'code'   => 'DOC-' . Str::random(4),
            'status' => 'need_approval',
        ]);
    }

    private function makeInstance(SignatureRenderTestDocument $document): ApprovalInstance {
        return ApprovalInstance::create([
            'approval_scheme_id' => $this->schemeId,
            'document_type'      => SignatureRenderTestDocument::class,
            'document_id'        => $document->id,
            'status'             => FormStatus::PENDING->value,
            'current_sequence'   => 0,
        ]);
    }

    /**
     * @param  FormStatus  $status  status step
     */
    private function makeStep(
        ApprovalInstance $instance,
        int $sequence,
        FormStatus $status,
        ?User $actedBy = null,
        ?User $approver = null,
    ): ApprovalInstanceStep {
        // approverable_id NOT NULL: step yang belum (atau tidak pernah)
        // ditindak tetap punya kandidat approver. Yang membedakan adalah
        // acted_by_id, dan itulah yang dibaca resolver.
        $approver ??= $actedBy ?? $this->makeUser('Kandidat ' . $sequence);

        return ApprovalInstanceStep::create([
            'approval_instance_id' => $instance->id,
            'sequence'             => $sequence,
            'status'               => $status->value,
            'approver_type'        => 'user',
            'approverable_id'      => $approver->id,
            'approverable_type'    => User::class,
            'is_advanced'          => false,
            'acted_by_id'          => $actedBy?->id,
            'acted_at'             => $actedBy ? now() : null,
        ]);
    }

    private function resolve(SignatureRenderTestDocument $document): ?array {
        $document->refresh()->load('approvalable.steps.actedBy.signatureFile');

        return app(SignatureResolverService::class)->resolveFinalSignature($document);
    }

    #[Test]
    public function only_the_last_approved_step_signature_is_used(): void {
        $officer = $this->makeUser('Officer', withSignature: true);
        $manager = $this->makeUser('Manager', withSignature: true);
        $finance = $this->makeUser('Finance Manager', withSignature: true);

        $document = $this->makeDocument();
        $instance = $this->makeInstance($document);
        $this->makeStep($instance, 0, FormStatus::APPROVED, $officer);
        $this->makeStep($instance, 1, FormStatus::APPROVED, $manager);
        $this->makeStep($instance, 2, FormStatus::APPROVED, $finance);

        $signature = $this->resolve($document);

        $this->assertNotNull($signature);
        $this->assertSame('Finance Manager', $signature['name']);
        $this->assertTrue($signature['hasSignature']);
        $this->assertStringStartsWith('data:image/png;base64,', $signature['image']);
    }

    #[Test]
    public function final_signer_without_signature_falls_back_to_name_and_date(): void {
        $manager = $this->makeUser('Manager Tanpa TTD');

        $document = $this->makeDocument();
        $instance = $this->makeInstance($document);
        $this->makeStep($instance, 0, FormStatus::APPROVED, $manager);

        $signature = $this->resolve($document);

        $this->assertNotNull($signature);
        $this->assertFalse($signature['hasSignature']);
        $this->assertNull($signature['image']);
        $this->assertSame('Manager Tanpa TTD', $signature['name']);
        $this->assertNotNull($signature['date']);
    }

    #[Test]
    public function document_without_any_approved_step_yields_null(): void {
        $document = $this->makeDocument();
        $instance = $this->makeInstance($document);
        $this->makeStep($instance, 0, FormStatus::PENDING);
        $this->makeStep($instance, 1, FormStatus::WAITING);

        $this->assertNull($this->resolve($document));
    }

    /**
     * Kasus yang membedakan implementasi benar dari `max(sequence)` naif:
     * step terakhir masih WAITING, jadi penandatangan adalah approver step
     * sebelumnya, bukan slot kosong.
     */
    #[Test]
    public function waiting_last_step_falls_back_to_previous_approved_step(): void {
        $manager = $this->makeUser('Manager', withSignature: true);

        $document = $this->makeDocument();
        $instance = $this->makeInstance($document);
        $this->makeStep($instance, 0, FormStatus::APPROVED, $manager);
        $this->makeStep($instance, 1, FormStatus::WAITING);

        $signature = $this->resolve($document);

        $this->assertNotNull($signature);
        $this->assertSame('Manager', $signature['name']);
    }

    /**
     * Auto-approve: requester adalah approver step terakhir, step-step
     * sebelumnya SKIPPED. Yang tercetak tanda tangan requester.
     */
    #[Test]
    public function auto_approved_last_step_uses_requester_signature(): void {
        $requester = $this->makeUser('Requester Finance', withSignature: true);

        $document = $this->makeDocument();
        $instance = $this->makeInstance($document);
        $this->makeStep($instance, 0, FormStatus::SKIPPED);
        $this->makeStep($instance, 1, FormStatus::SKIPPED);
        $this->makeStep($instance, 2, FormStatus::APPROVED, $requester);

        $signature = $this->resolve($document);

        $this->assertNotNull($signature);
        $this->assertSame('Requester Finance', $signature['name']);
        $this->assertTrue($signature['hasSignature']);
    }

    /**
     * Kasus kedua yang membedakan dari `max(sequence)` naif: step terakhir
     * approved TANPA acted_by_id (data lama), harus jatuh ke step approved
     * sebelumnya yang penandatangannya ada.
     */
    #[Test]
    public function approved_step_without_actor_falls_back_to_earlier_step(): void {
        $manager = $this->makeUser('Manager', withSignature: true);

        $document = $this->makeDocument();
        $instance = $this->makeInstance($document);
        $this->makeStep($instance, 0, FormStatus::APPROVED, $manager);
        $this->makeStep($instance, 1, FormStatus::APPROVED);

        $signature = $this->resolve($document);

        $this->assertNotNull($signature);
        $this->assertSame('Manager', $signature['name']);
    }

    #[Test]
    public function document_without_approval_instance_yields_null(): void {
        $this->assertNull($this->resolve($this->makeDocument()));
    }

    #[Test]
    public function resolving_twice_does_not_issue_extra_queries_per_call(): void {
        $signer = $this->makeUser('Signer', withSignature: true);

        $document = $this->makeDocument();
        $instance = $this->makeInstance($document);
        $this->makeStep($instance, 0, FormStatus::APPROVED, $signer);

        $document->refresh()->load('approvalable.steps.actedBy.signatureFile');
        $resolver = app(SignatureResolverService::class);

        // Relasi sudah ter-eager-load, jadi resolusi berjalan murni di
        // memori: template dengan beberapa slot tidak boleh memicu query
        // tambahan per slot.
        DB::enableQueryLog();
        DB::flushQueryLog();

        $resolver->resolveFinalSignature($document);
        $resolver->resolveFinalSignature($document);

        $this->assertSame([], DB::getQueryLog());
    }

    /**
     * Verifikasi menyeluruh untuk skenario utama fitur ini: dokumen tiga
     * step yang seluruhnya approved, dirender sampai menjadi byte PDF
     * sungguhan lewat PdfExportService.
     *
     * Dibuat sebagai test, bukan pemeriksaan manual sekali jalan, supaya
     * jaminannya bertahan. Yang dibuktikan: HANYA tanda tangan step
     * terakhir yang masuk ke HTML hasil render, dan PDF-nya benar-benar
     * terbentuk pada jalur renderer yang tersedia di lingkungan ini.
     */
    #[Test]
    public function three_step_document_renders_only_the_last_signature_into_pdf(): void {
        $officer = $this->makeUser('Officer Satu', withSignature: true);
        $manager = $this->makeUser('Manager Dua', withSignature: true);
        $finance = $this->makeUser('Finance Tiga', withSignature: true);

        $document = $this->makeDocument();
        $instance = $this->makeInstance($document);
        $this->makeStep($instance, 0, FormStatus::APPROVED, $officer);
        $this->makeStep($instance, 1, FormStatus::APPROVED, $manager);
        $this->makeStep($instance, 2, FormStatus::APPROVED, $finance);

        $document->refresh()->load('approvalable.steps.actedBy.signatureFile');

        $template = new PrintTemplate([
            'name'        => 'Signature E2E',
            'name_model'  => 'SignatureRenderTestDocument',
            'model'       => SignatureRenderTestDocument::class,
            'orientation' => 'portrait',
            'unit'        => 'cm',
            'width'       => 21,
            'height'      => 29.7,
            'html'        => '<html><body><div>{{{approvalSignature showName=true showDate=true}}}</div></body></html>',
        ]);

        $html = app(PrintTemplateRenderService::class)->render($document, $template, []);

        // Hanya penandatangan final yang muncul.
        $this->assertStringContainsString('Finance Tiga', $html);
        $this->assertStringNotContainsString('Officer Satu', $html);
        $this->assertStringNotContainsString('Manager Dua', $html);

        // Gambarnya disisipkan sebagai data URI, bukan URL: renderer PDF
        // berjalan tanpa sesi login sehingga route terproteksi akan gagal.
        $this->assertStringContainsString('data:image/png;base64,', $html);
        $this->assertStringNotContainsString('users.showSignature', $html);

        // Dan HTML itu benar-benar bisa menjadi PDF. generate() memilih
        // wkhtmltopdf bila ada, dompdf bila tidak; keduanya harus
        // menghasilkan berkas PDF yang sah.
        $pdf = app(PdfExportService::class)->generate($html, $template);

        $this->assertStringStartsWith('%PDF', $pdf);
        $this->assertGreaterThan(1000, \strlen($pdf));
    }

    /**
     * Sisi lain dari skenario yang sama: penandatangan final belum punya
     * tanda tangan, jadi slot diisi nama dan tanggal (FR9), bukan
     * dibiarkan kosong.
     */
    #[Test]
    public function fallback_text_reaches_the_rendered_pdf(): void {
        $manager = $this->makeUser('Manager Tanpa Tanda Tangan');

        $document = $this->makeDocument();
        $instance = $this->makeInstance($document);
        $this->makeStep($instance, 0, FormStatus::APPROVED, $manager);

        $document->refresh()->load('approvalable.steps.actedBy.signatureFile');

        $template = new PrintTemplate([
            'name'        => 'Signature Fallback E2E',
            'name_model'  => 'SignatureRenderTestDocument',
            'model'       => SignatureRenderTestDocument::class,
            'orientation' => 'portrait',
            'unit'        => 'cm',
            'width'       => 21,
            'height'      => 29.7,
            'html'        => '<html><body><div>{{{approvalSignature}}}</div></body></html>',
        ]);

        $html = app(PrintTemplateRenderService::class)->render($document, $template, []);

        $this->assertStringContainsString('Manager Tanpa Tanda Tangan', $html);
        $this->assertStringNotContainsString('data:image/png;base64,', $html);

        $pdf = app(PdfExportService::class)->generate($html, $template);
        $this->assertStringStartsWith('%PDF', $pdf);
    }
}
