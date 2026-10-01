<?php

namespace Tests\Feature\CRM;

use App\Models\Core\Preference;
use App\Models\CRM\Quotation;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * Field header surat dan aturan wajib per jenis (R2, R3): spec quotation-letter-fields.
 */
class QuotationLetterFieldsTest extends QuotationTestCase {
    /**
     * @param  array<string, mixed>  $overrides
     */
    private function submit(array $overrides) {
        return $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->postJson(route('quotations.store'), $this->payload($overrides));
    }

    public function test_menyimpan_semua_field_header_surat(): void {
        $quotation = $this->storeQuotation([
            'type'         => 'new_unit',
            'attn'         => 'Bapak Faqih / Ibu Dwi',
            'subject'      => 'Quotation New XCMG Diesel Reachstacker',
            'issued_city'  => 'Surabaya',
            'introduction' => "We hereby have the pleasure\nto offer you the following :",
            'valid_until'  => '2026-10-21',
        ]);

        $this->assertSame('new_unit', $quotation->type);
        $this->assertSame('Bapak Faqih / Ibu Dwi', $quotation->attn);
        $this->assertSame('Quotation New XCMG Diesel Reachstacker', $quotation->subject);
        $this->assertSame('Surabaya', $quotation->issued_city);
        $this->assertSame("We hereby have the pleasure\nto offer you the following :", $quotation->introduction);
        $this->assertSame('2026-10-21', $quotation->valid_until->toDateString());
    }

    public function test_type_disimpan_sebagai_string_biasa_tanpa_cast(): void {
        $quotation = $this->storeQuotation(['type' => 'rental', 'subject' => 'Rental', 'valid_until' => '2026-10-22']);

        $this->assertIsString($quotation->type);
        $this->assertArrayNotHasKey('type', $quotation->getCasts());
        $this->assertSame('rental', $quotation->getRawOriginal('type'));
    }

    public function test_field_header_dimuat_kembali_di_halaman_detail(): void {
        $quotation = $this->storeQuotation([
            'attn'        => 'Bp. Antok Jatmiko (General Manager LR 3 Surabaya)',
            'issued_city' => 'Surabaya',
            'subject'     => 'Perihal opsional',
        ]);

        $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->get(route('quotations.show', $quotation))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('CRM/Quotations/Show')
                ->where('quotation.type', 'spare_part')
                ->where('quotation.attn', 'Bp. Antok Jatmiko (General Manager LR 3 Surabaya)')
                ->where('quotation.issued_city', 'Surabaya')
                ->where('quotation.subject', 'Perihal opsional')
                ->where('quotation.introduction', 'Berikut kami sampaikan penawarannya :'));
    }

    public function test_spare_part_tidak_mewajibkan_subject_dan_valid_until(): void {
        $this->submit(['type' => 'spare_part'])->assertRedirect();

        $this->assertSame(1, Quotation::count());
    }

    /**
     * @return array<string, array{string}>
     */
    public static function letterTypes(): array {
        return [
            'new_unit' => ['new_unit'],
            'rental'   => ['rental'],
        ];
    }

    #[DataProvider('letterTypes')]
    public function test_subject_dan_valid_until_wajib_untuk_new_unit_dan_rental(string $type): void {
        $this->submit(['type' => $type])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['subject', 'valid_until']);

        $this->assertSame(0, Quotation::count());
    }

    #[DataProvider('letterTypes')]
    public function test_new_unit_dan_rental_lolos_bila_subject_dan_valid_until_terisi(string $type): void {
        $this->submit([
            'type'        => $type,
            'subject'     => 'Rental Price Quote Reachstacker',
            'valid_until' => '2026-10-22',
        ])->assertRedirect();

        $this->assertSame(1, Quotation::count());
    }

    public function test_valid_until_tidak_boleh_sebelum_tanggal_surat(): void {
        $this->submit(['valid_until' => '2026-09-01'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['valid_until']);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function allTypes(): array {
        return [
            'spare_part' => ['spare_part'],
            'new_unit'   => ['new_unit'],
            'rental'     => ['rental'],
        ];
    }

    #[DataProvider('allTypes')]
    public function test_attn_dan_introduction_wajib_untuk_semua_jenis(string $type): void {
        $payload = $this->payload([
            'type'        => $type,
            'subject'     => 'Subject',
            'valid_until' => '2026-10-22',
        ]);
        unset($payload['attn'], $payload['introduction']);

        $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->postJson(route('quotations.store'), $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['attn', 'introduction']);
    }

    public function test_type_wajib_dan_hanya_menerima_tiga_nilai(): void {
        $this->submit(['type' => 'lainnya'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['type']);

        $payload = $this->payload();
        unset($payload['type']);
        $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->postJson(route('quotations.store'), $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['type']);
    }

    public function test_issued_city_opsional(): void {
        $this->submit(['issued_city' => null])->assertRedirect();

        $this->assertNull(Quotation::firstOrFail()->issued_city);
    }

    public function test_jenis_dapat_diubah_dan_data_lain_tidak_terhapus(): void {
        $quotation = $this->storeQuotation([
            'type'        => 'new_unit',
            'subject'     => 'Subject asli',
            'valid_until' => '2026-10-21',
        ]);

        $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->putJson(route('quotations.update', $quotation), $this->payload([
                'type'    => 'spare_part',
                'subject' => 'Subject asli',
                'items'   => [[
                    'id'       => $quotation->items()->first()->id,
                    'item'     => ['id' => $this->variant->id],
                    'quantity' => 2,
                    'price'    => 100,
                ]],
            ]))
            ->assertRedirect();

        $quotation->refresh();
        $this->assertSame('spare_part', $quotation->type);
        $this->assertSame('Subject asli', $quotation->subject);
        $this->assertSame('2026-10-21', $quotation->valid_until->toDateString());
    }

    public function test_form_baru_membawa_kota_terbit_dari_preference_city(): void {
        Preference::create(['key' => 'city', 'value' => 'Surabaya']);

        $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->get(route('quotations.create'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('CRM/Quotations/Show')
                ->where('defaultData.issued_city', 'Surabaya'));
    }

    public function test_form_baru_tanpa_pajak_aktif_tetap_berfungsi(): void {
        $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->get(route('quotations.create'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('defaultData.active_tax_id', null));
    }
}
