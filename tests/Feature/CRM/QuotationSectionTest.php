<?php

namespace Tests\Feature\CRM;

use App\Models\CRM\Quotation;
use App\Models\CRM\QuotationSection;
use App\Models\CRM\QuotationSectionTemplate;
use Database\Seeders\QuotationSectionTemplateSeeder;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia;

/**
 * Blok teks bebas Quotation (R5): simpan, urutkan, hapus, dan template.
 */
class QuotationSectionTest extends QuotationTestCase {
    /**
     * @param  array<string, mixed>  $overrides
     */
    private function update(Quotation $quotation, array $overrides) {
        return $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->putJson(route('quotations.update', $quotation), $this->payload([
                'items' => [[
                    'id'       => $quotation->items()->firstOrFail()->id,
                    'item'     => ['id' => $this->variant->id],
                    'quantity' => 2,
                    'price'    => 100,
                ]],
                ...$overrides,
            ]));
    }

    /**
     * @return array<int, string>
     */
    private function titles(Quotation $quotation): array {
        return $quotation->sections()->get()->pluck('title')->all();
    }

    public function test_menyimpan_blok_berurutan_beserta_isi_multi_baris(): void {
        $quotation = $this->storeQuotation(['sections' => [
            ['id' => 'a', 'title' => 'Note', 'content' => "- satu\n- dua"],
            ['id' => 'b', 'title' => 'Term of Payment', 'content' => "1. Regularly monthly payment.\n2. Mob and de mob cost."],
        ]]);

        $this->assertSame(['Note', 'Term of Payment'], $this->titles($quotation));
        $this->assertSame("- satu\n- dua", $quotation->sections()->first()->content);
        $this->assertSame([0, 1], $quotation->sections()->pluck('order')->map(fn ($o) => (int) $o)->all());
    }

    public function test_quotation_tanpa_blok_diizinkan(): void {
        $quotation = $this->storeQuotation();

        $this->assertSame(0, $quotation->sections()->count());
    }

    public function test_menyimpan_blok_tanpa_order_memakai_urutan_kirim(): void {
        $quotation = $this->storeQuotation(['sections' => [
            ['id' => 'a', 'title' => 'Pertama', 'content' => 'x'],
            ['id' => 'b', 'title' => 'Kedua', 'content' => 'y'],
            ['id' => 'c', 'title' => 'Ketiga', 'content' => 'z'],
        ]]);

        $this->assertSame(['Pertama', 'Kedua', 'Ketiga'], $this->titles($quotation));
    }

    public function test_halaman_detail_memuat_blok_terurut_menurut_order(): void {
        $quotation = $this->storeQuotation(['sections' => [
            ['id' => 'a', 'title' => 'Kedua', 'content' => 'y', 'order' => 1],
            ['id' => 'b', 'title' => 'Pertama', 'content' => 'x', 'order' => 0],
        ]]);

        $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->get(route('quotations.show', $quotation))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('quotation.sections.0.title', 'Pertama')
                ->where('quotation.sections.1.title', 'Kedua'));
    }

    public function test_mengurutkan_ulang_blok_menyimpan_urutan_baru(): void {
        $quotation = $this->storeQuotation(['sections' => [
            ['id' => 'a', 'title' => 'A', 'content' => 'a'],
            ['id' => 'b', 'title' => 'B', 'content' => 'b'],
            ['id' => 'c', 'title' => 'C', 'content' => 'c'],
        ]]);
        [$a, $b, $c] = $quotation->sections()->get()->all();

        $this->update($quotation, ['sections' => [
            ['id' => $c->id, 'title' => 'C', 'content' => 'c', 'order' => 0],
            ['id' => $a->id, 'title' => 'A', 'content' => 'a', 'order' => 1],
            ['id' => $b->id, 'title' => 'B', 'content' => 'b', 'order' => 2],
        ]])->assertRedirect();

        $this->assertSame(['C', 'A', 'B'], $this->titles($quotation));
        $this->assertSame(3, QuotationSection::count(), 'blok diperbarui, bukan dibuat ulang');
    }

    public function test_mengubah_isi_blok_yang_ada_memperbarui_barisnya(): void {
        $quotation = $this->storeQuotation(['sections' => [
            ['id' => 'a', 'title' => 'Note', 'content' => 'lama'],
        ]]);
        $section = $quotation->sections()->firstOrFail();

        $this->update($quotation, ['sections' => [
            ['id' => $section->id, 'title' => 'Note', 'content' => 'baru', 'order' => 0],
        ]])->assertRedirect();

        $this->assertSame('baru', $section->fresh()->content);
        $this->assertSame(1, QuotationSection::count());
    }

    public function test_menambah_blok_baru_saat_update(): void {
        $quotation = $this->storeQuotation(['sections' => [
            ['id' => 'a', 'title' => 'Note', 'content' => 'n'],
        ]]);
        $existing = $quotation->sections()->firstOrFail();

        $this->update($quotation, ['sections' => [
            ['id' => $existing->id, 'title' => 'Note', 'content' => 'n', 'order' => 0],
            ['id' => 'temp-id-baru', 'title' => 'Owner Obligation', 'content' => 'o', 'order' => 1],
        ]])->assertRedirect();

        $this->assertSame(['Note', 'Owner Obligation'], $this->titles($quotation));
    }

    public function test_menghapus_blok_yang_tidak_ada_di_payload(): void {
        $quotation = $this->storeQuotation(['sections' => [
            ['id' => 'a', 'title' => 'A', 'content' => 'a'],
            ['id' => 'b', 'title' => 'B', 'content' => 'b'],
        ]]);
        $keep = $quotation->sections()->where('title', 'A')->firstOrFail();

        $this->update($quotation, ['sections' => [
            ['id' => $keep->id, 'title' => 'A', 'content' => 'a', 'order' => 0],
        ]])->assertRedirect();

        $this->assertSame(['A'], $this->titles($quotation));
    }

    public function test_sections_kosong_menghapus_semua_blok(): void {
        $quotation = $this->storeQuotation(['sections' => [
            ['id' => 'a', 'title' => 'A', 'content' => 'a'],
        ]]);

        $this->update($quotation, ['sections' => []])->assertRedirect();

        $this->assertSame(0, QuotationSection::count());
    }

    public function test_update_tanpa_key_sections_tidak_menghapus_blok(): void {
        $quotation = $this->storeQuotation(['sections' => [
            ['id' => 'a', 'title' => 'A', 'content' => 'a'],
        ]]);

        $this->update($quotation, [])->assertRedirect();

        $this->assertSame(['A'], $this->titles($quotation));
    }

    public function test_blok_dari_quotation_lain_tidak_ikut_terhapus(): void {
        $first  = $this->storeQuotation(['sections' => [['id' => 'a', 'title' => 'Punya pertama', 'content' => 'a']]]);
        $second = $this->storeQuotation(['sections' => [['id' => 'b', 'title' => 'Punya kedua', 'content' => 'b']]]);

        $this->update($second, ['sections' => []])->assertRedirect();

        $this->assertSame(['Punya pertama'], $this->titles($first));
        $this->assertSame(0, $second->sections()->count());
    }

    public function test_judul_dan_isi_blok_wajib(): void {
        $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->postJson(route('quotations.store'), $this->payload(['sections' => [
                ['id' => 'a', 'title' => '', 'content' => ''],
            ]]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['sections.0.title', 'sections.0.content']);

        $this->assertSame(0, Quotation::count());
    }

    public function test_blok_ikut_terhapus_saat_quotation_dihapus_permanen(): void {
        $quotation = $this->storeQuotation(['sections' => [
            ['id' => 'a', 'title' => 'A', 'content' => 'a'],
        ]]);

        $quotation->forceDelete();

        $this->assertSame(0, QuotationSection::count());
    }

    // ---- Template blok (AC5.4, AC5.5, AC5.7) ----------------------------------

    public function test_seeder_menyediakan_lima_template_sesuai_surat_contoh(): void {
        $this->seed(QuotationSectionTemplateSeeder::class);

        $templates = QuotationSectionTemplate::orderBy('order')->get();
        $this->assertCount(5, $templates);

        $byTitle = $templates->keyBy('title');
        $this->assertSame('new_unit', $byTitle['Terms & Conditions']->quotation_type);
        foreach (['Note', 'Term of Payment', 'Owner Obligation', 'Tenant Obligation'] as $title) {
            $this->assertSame('rental', $byTitle[$title]->quotation_type, $title);
        }
    }

    public function test_isi_template_sama_persis_dengan_surat_contoh(): void {
        $this->seed(QuotationSectionTemplateSeeder::class);
        $byTitle = QuotationSectionTemplate::all()->keyBy('title');

        $this->assertSame(
            "1. Terms of payment: 20% down payment after contract signed before shipping, 80% balance payment paid at the time of handover the unit.\n"
            . "2. Warranty period: 24 months from B/L date or 4000 working hours whichever comes first.\n"
            . '3. Quotation Validity: 14 days from the quotation date.',
            $byTitle['Terms & Conditions']->content,
        );
        $this->assertSame(
            "1. Regularly monthly payment.\n"
            . "2. Mob and de mob cost (if any) should be paid in advance.\n"
            . '3. The rental fee for the next month will be billed one week before the current tenancy ends.',
            $byTitle['Term of Payment']->content,
        );
        $this->assertCount(4, explode("\n", $byTitle['Owner Obligation']->content));
        $this->assertCount(6, explode("\n", $byTitle['Tenant Obligation']->content));
        $this->assertStringContainsString('Provide 2 (two) trained and licensed operators.', $byTitle['Owner Obligation']->content);
        $this->assertStringContainsString('Grant access permission to the depot.', $byTitle['Tenant Obligation']->content);
    }

    public function test_seeder_idempoten_dan_memulihkan_isi_yang_berubah(): void {
        $this->seed(QuotationSectionTemplateSeeder::class);
        QuotationSectionTemplate::where('title', 'Note')->update(['content' => 'diubah']);

        $this->seed(QuotationSectionTemplateSeeder::class);

        $this->assertSame(5, QuotationSectionTemplate::count());
        $this->assertStringContainsString('Rental time minimum', QuotationSectionTemplate::where('title', 'Note')->value('content'));
    }

    public function test_halaman_baru_dan_detail_mengirim_template_ke_frontend(): void {
        $this->seed(QuotationSectionTemplateSeeder::class);
        $quotation = $this->storeQuotation();

        foreach ([route('quotations.create'), route('quotations.show', $quotation)] as $url) {
            $this->actingAs($this->user)
                ->withSession($this->permissionSession())
                ->get($url)
                ->assertOk()
                ->assertInertia(fn (AssertableInertia $page) => $page
                    ->has('sectionTemplates', 5)
                    ->where('sectionTemplates.0.order', 1));
        }
    }

    public function test_menyalin_template_ke_quotation_tidak_mengubah_master(): void {
        $this->seed(QuotationSectionTemplateSeeder::class);
        $template = QuotationSectionTemplate::where('title', 'Terms & Conditions')->firstOrFail();
        $original = $template->content;

        // Frontend menyalin judul dan isi template ke blok dokumen (tanpa id master).
        $quotation = $this->storeQuotation(['sections' => [
            ['id' => 'salinan', 'title' => $template->title, 'content' => $template->content],
        ]]);
        $section = $quotation->sections()->firstOrFail();
        $this->assertSame($original, $section->content);

        $this->update($quotation, ['sections' => [
            ['id' => $section->id, 'title' => 'Terms & Conditions', 'content' => 'Isi sudah diedit untuk penawaran ini', 'order' => 0],
        ]])->assertRedirect();

        $this->assertSame('Isi sudah diedit untuk penawaran ini', $section->fresh()->content);
        $this->assertSame($original, $template->fresh()->content, 'master template tidak berubah');
        $this->assertSame(5, QuotationSectionTemplate::count());
    }

    public function test_blok_dokumen_tidak_menyimpan_referensi_ke_template(): void {
        $this->assertFalse(
            Schema::hasColumn('quotation_sections', 'quotation_section_template_id'),
            'isi disalin (pola P3), bukan direferensikan',
        );
    }
}
