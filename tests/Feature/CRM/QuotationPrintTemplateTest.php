<?php

namespace Tests\Feature\CRM;

use App\Models\Core\PrintTemplate;
use App\Models\CRM\Quotation;
use App\Services\Core\PrintTemplate\PrintTemplateRenderService;
use App\Services\Core\PrintTemplate\RelationTrackerService;
use Database\Seeders\QuotationPrintTemplateSeeder;

/**
 * lightncandy tidak dapat memuat helper bersintaks arrow function: helper `companyDetail`
 * di PrintTemplateRenderService memakai `fn` sehingga kode hasil kompilasi tidak valid,
 * dan helper `approvalSignature` belum ada di branch ini. Test render memakai helper
 * setara bersintaks `function` supaya yang diuji adalah markup template, bukan masalah itu.
 */
class RenderServiceWithFunctionHelpers extends PrintTemplateRenderService {
    protected function helpers(): array {
        return [
            ...parent::helpers(),
            'companyDetail' => function ($key, $options) {
                return $options['data']['root']['company'][$key] ?? '';
            },
            'approvalSignature' => function ($options) {
                return '[TTD]';
            },
        ];
    }
}

/**
 * Template cetak Quotation per jenis surat (R8): pemilihan template menurut
 * `type`, fallback, dan isi hasil render.
 */
class QuotationPrintTemplateTest extends QuotationTestCase {
    private function seedTemplates(): void {
        $this->seed(QuotationPrintTemplateSeeder::class);
    }

    private function template(string $type): PrintTemplate {
        return PrintTemplate::where('model', Quotation::class)
            ->where('name', Quotation::PRINT_TEMPLATE_BY_TYPE[$type])
            ->firstOrFail();
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function quotationOfType(string $type, array $overrides = []): Quotation {
        $extra = $type === 'spare_part' ? [] : [
            'subject'     => 'Rental Price Quote Reachstacker',
            'valid_until' => '2026-10-22',
        ];

        return $this->storeQuotation([...$extra, 'type' => $type, ...$overrides]);
    }

    private function selectedTemplateName(Quotation $quotation, ?PrintTemplate $explicit = null): string {
        $url = $explicit
            ? route('quotations.print', [$quotation, $explicit])
            : route('quotations.print', $quotation);

        $content = $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->get($url)
            ->assertOk()
            ->getContent();

        // Halaman Inertia v3 menyertakan datanya di tag <script data-page>.
        $this->assertSame(1, preg_match('/<script[^>]*data-page[^>]*>(.*?)<\/script>/s', $content, $matches));
        $page = json_decode(html_entity_decode($matches[1]), true, flags: JSON_THROW_ON_ERROR);

        $this->assertSame('Core/Print', $page['component']);

        return $page['props']['printTemplate']['name'];
    }

    /**
     * Render HTML dengan relasi yang dimuat seperti QuotationController::print().
     */
    private function render(Quotation $quotation, PrintTemplate $template): string {
        $tracker = app(RelationTrackerService::class);
        [
            'relations'    => $relations,
            'modelColumns' => $columns,
        ] = $tracker->validateRelations(Quotation::class, $template->getUsedRelations(), true);

        $quotation->load($relations);

        return app(RenderServiceWithFunctionHelpers::class)->render($quotation, $template, $columns);
    }

    // ---- Penyediaan template (AC8.1, AC8.12) ----------------------------------

    public function test_seeder_membuat_tiga_template_dengan_bahasa_masing_masing(): void {
        $this->seedTemplates();

        $templates = PrintTemplate::where('model', Quotation::class)->get()->keyBy('name');

        $this->assertCount(3, $templates);
        $this->assertSame('id', $templates['Default - Quotation Spare Part']->default_language);
        $this->assertSame('en', $templates['Default - Quotation New Unit']->default_language);
        $this->assertSame('en', $templates['Default - Quotation Rental']->default_language);
    }

    public function test_seeder_idempoten(): void {
        $this->seedTemplates();
        $this->seedTemplates();

        $this->assertSame(3, PrintTemplate::where('model', Quotation::class)->count());
    }

    public function test_template_lama_diubah_menjadi_varian_spare_part_bukan_diduplikasi(): void {
        $letterHead = PrintTemplate::create([
            'name'             => 'Kop Surat Default',
            'is_letter_head'   => true,
            'is_default'       => true,
            'default_language' => 'id',
            'html'             => '<body>kop</body>',
            'css'              => '',
        ]);
        $legacy = PrintTemplate::create([
            'name'             => 'Default - Quotation',
            'model'            => Quotation::class,
            'is_default'       => true,
            'letter_head_id'   => $letterHead->id,
            'default_language' => 'id',
            'html'             => '<body>lama</body>',
            'css'              => '',
        ]);

        $this->seedTemplates();

        $this->assertSame(3, PrintTemplate::where('model', Quotation::class)->count());
        $this->assertNull(PrintTemplate::where('name', 'Default - Quotation')->first());

        $sparePart = $this->template('spare_part');
        $this->assertSame($legacy->id, $sparePart->id);
        $this->assertTrue($sparePart->is_default, 'pilihan default tetap pada varian spare part');
        $this->assertStringNotContainsString('lama', $sparePart->html);
        foreach (['spare_part', 'new_unit', 'rental'] as $type) {
            $this->assertSame($letterHead->id, $this->template($type)->letter_head_id, "kop surat {$type}");
        }
        $this->assertFalse($this->template('new_unit')->is_default);
        $this->assertFalse($this->template('rental')->is_default);
    }

    public function test_template_tidak_menduplikasi_kop_surat(): void {
        $this->seedTemplates();

        foreach (['spare_part', 'new_unit', 'rental'] as $type) {
            $html = $this->template($type)->html;
            $this->assertStringNotContainsString('letterhead', $html, $type);
            $this->assertFalse($this->template($type)->is_letter_head);
        }
    }

    // ---- Pemilihan template (AC8.2) -------------------------------------------

    public function test_template_terpilih_sesuai_jenis_quotation(): void {
        $this->seedTemplates();

        foreach (['spare_part', 'new_unit', 'rental'] as $type) {
            $quotation = $this->quotationOfType($type);

            $this->assertSame(
                Quotation::PRINT_TEMPLATE_BY_TYPE[$type],
                $this->selectedTemplateName($quotation),
                $type,
            );
        }
    }

    public function test_jatuh_ke_template_default_bila_template_jenis_tidak_ada(): void {
        $this->seedTemplates();
        $this->template('new_unit')->delete();
        $quotation = $this->quotationOfType('new_unit');

        $this->assertSame('Default - Quotation Spare Part', $this->selectedTemplateName($quotation));
    }

    public function test_template_yang_dipilih_eksplisit_di_url_dihormati(): void {
        $this->seedTemplates();
        $quotation = $this->quotationOfType('spare_part');

        $this->assertSame(
            'Default - Quotation Rental',
            $this->selectedTemplateName($quotation, $this->template('rental')),
        );
    }

    public function test_template_jenis_tetap_dipakai_walau_bukan_default(): void {
        $this->seedTemplates();
        $this->assertFalse($this->template('rental')->is_default);

        $this->assertSame(
            'Default - Quotation Rental',
            $this->selectedTemplateName($this->quotationOfType('rental')),
        );
    }

    // ---- Isi hasil cetak (AC8.3 sampai AC8.8, AC4.5, AC5.6) -------------------

    public function test_cetak_spare_part_memuat_tabel_dan_ringkasan(): void {
        $this->seedTemplates();
        $quotation = $this->quotationOfType('spare_part', [
            'attn'     => 'Ibu Desy',
            'items'    => [[
                'id'          => 'a',
                'item'        => ['id' => $this->variant->id],
                'item_unit'   => ['id' => $this->makeItemUnit()->id],
                'quantity'    => 2,
                'price'       => 100,
                'remark'      => '1-2 hari',
                'description' => "Spesifikasi A\nSpesifikasi B",
            ]],
            'sections' => [['id' => 's', 'title' => 'Catatan', 'content' => "1. satu\n2. dua"]],
        ]);

        $html = $this->render($quotation, $this->template('spare_part'));

        $this->assertStringContainsString('Ibu Desy', $html);
        $this->assertStringContainsString('Yth Ibu Desy', $html);
        $this->assertStringContainsString('Berikut kami sampaikan penawarannya', $html);
        $this->assertStringContainsString('<table', $html);
        foreach (['Part No', 'Quantity', 'Unit Price Rp', 'Amount Rp', 'Remark', 'Sub Total', 'Total'] as $heading) {
            $this->assertStringContainsString($heading, $html, $heading);
        }
        $this->assertStringContainsString('1-2 hari', $html);
        $this->assertStringContainsString($this->variant->item_code, $html);
        $this->assertStringContainsString("Spesifikasi A\nSpesifikasi B", $html);
        $this->assertStringContainsString('Catatan', $html);
        $this->assertStringContainsString("1. satu\n2. dua", $html);
        $this->assertStringContainsString('Hormat kami,', $html);
    }

    public function test_cetak_new_unit_tanpa_ringkasan_harga(): void {
        $this->seedTemplates();
        $quotation = $this->quotationOfType('new_unit', [
            'attn'    => 'Bapak Faqih / Ibu Dwi',
            'subject' => 'Quotation New XCMG Diesel Reachstacker',
            'items'   => [[
                'id'          => 'a',
                'item'        => ['id' => $this->variant->id],
                'quantity'    => 1,
                'price'       => 5000,
                'remark'      => 'Unit Ready Jakarta',
                'description' => "Max Load Capacity: 45 ton\nEngine: Weichai",
            ]],
        ]);

        $html = $this->render($quotation, $this->template('new_unit'));

        $this->assertStringContainsString('Bapak Faqih / Ibu Dwi', $html);
        $this->assertStringContainsString('Quotation New XCMG Diesel Reachstacker', $html);
        foreach (['Equipment Type', 'Model', 'QTY', 'Before PPN', 'Lead Time'] as $heading) {
            $this->assertStringContainsString($heading, $html, $heading);
        }
        $this->assertStringContainsString('Unit Ready Jakarta', $html);
        $this->assertStringContainsString("Max Load Capacity: 45 ton\nEngine: Weichai", $html);
        $this->assertStringNotContainsString('Sub Total', $html);
        $this->assertStringContainsString('With kind regards,', $html);
        $this->assertStringContainsString('Valid by', $html);
    }

    public function test_cetak_rental_berupa_daftar_label_nilai_tanpa_tabel(): void {
        $this->seedTemplates();
        $quotation = $this->quotationOfType('rental', [
            'items' => [[
                'id'          => 'a',
                'item'        => ['id' => $this->variant->id],
                'quantity'    => 1,
                'price'       => 172000000,
                'description' => "Model: SRSC45H1\nYear Built: 2018\nCapacity: 45 ton",
            ]],
        ]);

        $html = $this->render($quotation, $this->template('rental'));

        $this->assertStringNotContainsString('<table', $html);
        foreach (['Name of product', 'Quantity', 'Rent price', 'Item Description'] as $label) {
            $this->assertStringContainsString($label, $html, $label);
        }
        $this->assertStringContainsString("Model: SRSC45H1\nYear Built: 2018\nCapacity: 45 ton", $html);
        $this->assertStringContainsString('month / unit', $html);
    }

    public function test_blok_dicetak_berurutan_dengan_judul_sebagai_heading(): void {
        $this->seedTemplates();
        $quotation = $this->quotationOfType('rental', ['sections' => [
            ['id' => 'a', 'title' => 'Owner Obligation', 'content' => 'isi owner', 'order' => 1],
            ['id' => 'b', 'title' => 'Note', 'content' => 'isi note', 'order' => 0],
            ['id' => 'c', 'title' => 'Tenant Obligation', 'content' => 'isi tenant', 'order' => 2],
        ]]);

        $html = $this->render($quotation, $this->template('rental'));

        $note   = strpos($html, 'isi note');
        $owner  = strpos($html, 'isi owner');
        $tenant = strpos($html, 'isi tenant');
        $this->assertNotFalse($note);
        $this->assertTrue($note < $owner && $owner < $tenant, 'urutan mengikuti kolom order');
        $this->assertStringContainsString('letter-section-title">Note<', $html);
    }

    public function test_tanpa_blok_tidak_ada_judul_blok_tercetak(): void {
        $this->seedTemplates();
        $quotation = $this->quotationOfType('spare_part');

        $html = $this->render($quotation, $this->template('spare_part'));

        $this->assertStringNotContainsString('letter-section-title', $html);
    }

    public function test_pemisah_baris_dijaga_lewat_css_pre_line(): void {
        $this->seedTemplates();

        foreach (['spare_part', 'new_unit', 'rental'] as $type) {
            $template = $this->template($type);
            $this->assertStringContainsString('.pre-line {', $template->css, $type);
            $this->assertStringContainsString('.letter-section-content {', $template->css, $type);
            $this->assertStringContainsString('white-space: pre-line', $template->css, $type);
            $this->assertStringContainsString('class="letter-section-content"', $template->html, $type);
            $this->assertStringContainsString('class="letter-intro"', $template->html, $type);
        }
        $this->assertStringContainsString('class="pre-line"', $this->template('spare_part')->html);
        $this->assertStringContainsString('pre-line', $this->template('new_unit')->html);
        $this->assertStringContainsString('pre-line', $this->template('rental')->html);
    }

    public function test_template_memakai_helper_tanda_tangan_penandatangan_final(): void {
        $this->seedTemplates();

        foreach (['spare_part', 'new_unit', 'rental'] as $type) {
            $this->assertStringContainsString('{{{approvalSignature', $this->template($type)->html, $type);
        }
    }

    public function test_relasi_yang_dimuat_mencakup_semua_data_template(): void {
        $this->seedTemplates();

        foreach (['spare_part', 'new_unit', 'rental'] as $type) {
            $relations = $this->template($type)->getUsedRelations();
            foreach (['customer', 'items', 'items.item', 'items.itemUnit', 'sections'] as $needed) {
                $this->assertContains($needed, $relations, "{$type}: {$needed}");
            }
        }
    }
}
