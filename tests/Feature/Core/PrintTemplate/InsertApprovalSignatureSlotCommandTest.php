<?php

namespace Tests\Feature\Core\PrintTemplate;

use App\Models\Core\PrintTemplate;
use App\Models\Inventory\DeliveryNote;
use App\Models\Purchase\PurchaseOrder;
use App\Models\User\User;
use App\Services\Core\PrintTemplate\ApprovalSignatureSlotInserter;
use App\Services\Core\PrintTemplate\RelationTrackerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class InsertApprovalSignatureSlotCommandTest extends TestCase {
    use RefreshDatabase;

    private const COMMAND = 'print-templates:insert-approval-signature';
    private const BODY    = "<body>\n  <div class=\"doc-title\">Judul</div>\n  <p>{{doc.code}}</p>\n</body>\n";

    /**
     * Project GrapesJS minimal dengan bentuk yang sama seperti hasil editor.
     *
     * @return array<string, mixed>
     */
    private function project(): array {
        return [
            'pages' => [[
                'id'     => 'p1',
                'type'   => 'main',
                'frames' => [[
                    'id'        => 'f1',
                    'component' => [
                        'type'       => 'wrapper',
                        'components' => [
                            ['tagName' => 'div', 'classes' => ['doc-title'], 'components' => [['type' => 'textnode', 'content' => 'Judul']]],
                        ],
                    ],
                ]],
            ]],
            'assets'  => [],
            'styles'  => [['style' => ['display' => 'grid'], 'selectors' => ['gjs-grid']]],
            'symbols' => [],
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function makeTemplate(string $name, array $overrides = []): PrintTemplate {
        return PrintTemplate::create([
            'name'       => $name,
            'model'      => DeliveryNote::class,
            'name_model' => 'Delivery Notes',
            'html'       => self::BODY,
            'css'        => "body {\n  font-size: 12px;\n}\n",
            'template'   => $this->project(),
            ...$overrides,
        ]);
    }

    #[Test]
    public function inserts_slot_into_html_css_and_project_json(): void {
        $template = $this->makeTemplate('Default - Delivery Note');

        $this->artisan(self::COMMAND)->assertSuccessful();

        $template->refresh();

        $this->assertStringContainsString('{{{approvalSignature showName=true}}}', $template->html);
        $this->assertStringContainsString('class="approval-slot"', $template->html);
        // Disisipkan sebelum penutup </body>, bukan sesudahnya.
        $this->assertLessThan(strripos($template->html, '</body>'), strpos($template->html, 'approvalSignature'));
        $this->assertStringContainsString('body .approval-slot {', $template->css);

        $components = $template->template['pages'][0]['frames'][0]['component']['components'];
        $this->assertCount(2, $components);
        $this->assertSame(['approval-slot'], $components[1]['classes']);
        $this->assertSame('approvalSignature', $components[1]['components'][0]['components'][1]['type']);

        $selectors = collect($template->template['styles'])->pluck('selectors')->flatten()->all();
        $this->assertContains('approval-slot', $selectors);
        $this->assertContains('gjs-grid', $selectors);
    }

    #[Test]
    public function html_only_template_is_updated_and_command_warns_about_project(): void {
        $template = $this->makeTemplate('Default - Purchase Order', [
            'model'    => PurchaseOrder::class,
            'template' => null,
        ]);

        $this->artisan(self::COMMAND)
            ->expectsOutputToContain('project GrapesJS')
            ->assertSuccessful();

        $template->refresh();

        $this->assertStringContainsString('approvalSignature', $template->html);
        $this->assertNull($template->template);
    }

    #[Test]
    public function unrecognised_project_shape_only_updates_html_and_warns(): void {
        $template = $this->makeTemplate('Default - Delivery Note', [
            'template' => ['aneh' => true],
        ]);

        $this->artisan(self::COMMAND)
            ->expectsOutputToContain('Default - Delivery Note')
            ->assertSuccessful();

        $template->refresh();

        $this->assertStringContainsString('approvalSignature', $template->html);
        $this->assertSame(['aneh' => true], $template->template);
    }

    #[Test]
    public function is_idempotent(): void {
        $template = $this->makeTemplate('Default - Delivery Note');

        $this->artisan(self::COMMAND)->assertSuccessful();
        $afterFirst = $template->fresh()->only(['html', 'css', 'template']);

        $this->artisan(self::COMMAND)->expectsOutputToContain('0 template disisipi')->assertSuccessful();
        $afterSecond = $template->fresh()->only(['html', 'css', 'template']);

        $this->assertSame($afterFirst, $afterSecond);
        $this->assertSame(1, substr_count($afterSecond['html'], '{{{approvalSignature'));
        $this->assertCount(2, $afterSecond['template']['pages'][0]['frames'][0]['component']['components']);
    }

    #[Test]
    public function skips_templates_that_already_contain_the_helper(): void {
        $html     = "<body>\n{{{approvalSignature showName=true showDate=true}}}\n</body>";
        $template = $this->makeTemplate('Default - Delivery Note', ['html' => $html]);

        $this->artisan(self::COMMAND)->assertSuccessful();

        $this->assertSame($html, $template->fresh()->html);
        $this->assertCount(1, $template->fresh()->template['pages'][0]['frames'][0]['component']['components']);
    }

    #[Test]
    public function skips_letter_heads(): void {
        $letterHead = $this->makeTemplate('Kop Surat Default', [
            'is_letter_head' => true,
            'model'          => null,
            'name_model'     => null,
        ]);

        $this->artisan(self::COMMAND)->assertSuccessful();

        $this->assertSame(self::BODY, $letterHead->fresh()->html);
        $this->assertStringNotContainsString('approvalSignature', $letterHead->fresh()->html);
    }

    #[Test]
    public function skips_templates_for_models_without_approval(): void {
        $template = $this->makeTemplate('Template User', [
            'model'      => User::class,
            'name_model' => 'Users',
        ]);

        $this->artisan(self::COMMAND)
            ->expectsOutputToContain('no_approval')
            ->assertSuccessful();

        $this->assertSame(self::BODY, $template->fresh()->html);
    }

    #[Test]
    public function dry_run_reports_without_changing_anything(): void {
        $template = $this->makeTemplate('Default - Delivery Note');
        $before   = $template->fresh()->only(['html', 'css', 'template', 'used_relations', 'updated_at']);

        $this->artisan(self::COMMAND, ['--dry-run' => true])
            ->expectsOutputToContain('akan disisipi: Default - Delivery Note')
            ->expectsOutputToContain('Tidak ada yang diubah')
            ->assertSuccessful();

        $this->assertEquals($before, $template->fresh()->only(['html', 'css', 'template', 'used_relations', 'updated_at']));
    }

    #[Test]
    public function only_default_option_limits_to_default_templates(): void {
        $default = $this->makeTemplate('Default - Delivery Note', ['is_default' => true]);
        $other   = $this->makeTemplate('Delivery Note Lain', ['is_default' => false]);

        $this->assertTrue($default->fresh()->is_default);
        $this->assertFalse($other->fresh()->is_default);

        $this->artisan(self::COMMAND, ['--only-default' => true])->assertSuccessful();

        $this->assertStringContainsString('approvalSignature', $default->fresh()->html);
        $this->assertStringNotContainsString('approvalSignature', $other->fresh()->html);
    }

    #[Test]
    public function slot_does_not_add_document_relations(): void {
        $template = $this->makeTemplate('Default - Delivery Note');
        $tracker  = app(RelationTrackerService::class);
        $before   = $tracker->extractRelationsFromHTML($template->html);

        $this->artisan(self::COMMAND)->assertSuccessful();

        $this->assertSame($before, $tracker->extractRelationsFromHTML($template->fresh()->html));
    }

    #[Test]
    public function inserter_appends_when_html_has_no_closing_body(): void {
        $template = new PrintTemplate(['html' => '<div>isi</div>', 'model' => DeliveryNote::class]);

        app(ApprovalSignatureSlotInserter::class)->insert($template);

        $this->assertStringStartsWith('<div>isi</div>', $template->html);
        $this->assertStringContainsString('approvalSignature', $template->html);
    }
}
