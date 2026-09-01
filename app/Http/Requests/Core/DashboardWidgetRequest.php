<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;
use App\Models\Core\MenuItem;
use App\Models\DashboardWidget;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * desk-dashboard-builder — request khusus untuk endpoint Desk Home
 * (DeskController::updateDashboardWidgets), TERPISAH dari DashboardRequest
 * existing yang dipakai Settings/Dashboard/Form.jsx (dua form berbeda, dua
 * request berbeda, supaya perubahan skema di sini tidak menyentuh CRUD
 * Dashboard manual existing).
 */
class DashboardWidgetRequest extends BaseFormRequest {
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'widgets'        => ['present', 'array'],
            'widgets.*.type' => ['required', 'string', Rule::in(array_keys(DashboardWidget::VALID_PARENTS))],
            // number-card-chart-redesign: `widget` (Widget lama) pecah jadi
            // `numberCard`/`chart` — masing-masing hanya wajib utk type-nya
            // sendiri, exists check ke tabel baru masing-masing.
            'widgets.*.numberCard.id' => ['required_if:widgets.*.type,card', 'nullable', 'string', new ExistsExcludingTrashed('number_cards')],
            'widgets.*.chart.id'      => ['required_if:widgets.*.type,chart', 'nullable', 'string', new ExistsExcludingTrashed('charts')],
            'widgets.*.config'        => ['nullable', 'array'],
            // Wildcard generik agar Laravel validated() mempertahankan
            // SELURUH isi config (json/html/label/dst) — tanpa ini,
            // validated() men-strip key yang tidak disebut eksplisit di
            // rules(), walau sudah lolos rule 'array' di atas. Config
            // shape berbeda per tipe block (Requirement 2), jadi validasi
            // isinya sengaja longgar di sini — struktur detailnya sudah
            // terjamin benar dari FE (satu-satunya penulis payload), dan
            // field keamanan kritis (link_to, dst) tetap divalidasi ketat
            // lewat rule spesifik di bawah.
            'widgets.*.config.*'             => ['nullable'],
            'widgets.*.config.label.*'       => ['nullable'], // section: config.label = {json, html}
            'widgets.*.config.description.*' => ['nullable'], // section: config.description = {json, html}|null
            'widgets.*.width'                => ['required', 'integer', 'min:1', 'max:12'],
            'widgets.*.ref'                  => ['nullable', 'string'],
            'widgets.*.parent_ref'           => ['nullable', 'string'],
            'widgets.*.is_visible'           => ['nullable', 'boolean'],

            // Bug ditemukan: closure ini SEBELUMNYA jalan utk SEMUA row yang
            // punya link_to terisi, TERMASUK link_type=menu_item (value ULID
            // MenuItem, bukan URL) — otomatis gagal regex #^(https?://|/)#.
            // Closure sekarang cek $this->input(...link_type) milik BARIS
            // YANG SAMA dulu (via $attribute, bukan wildcard required_if yang
            // tidak reliable di-scope per-index) — validasi format URL HANYA
            // dijalankan saat link_type benar-benar "url"; link_type=menu_item
            // divalidasi terpisah di validateMenuItemLinks() (exists check).
            'widgets.*.config.link_to' => [
                'nullable',
                'string',
                'max:2048',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if (! is_string($value) || $value === '') {
                        return;
                    }

                    // $attribute contoh: "widgets.3.config.link_to" — ambil
                    // index array (segmen ke-2) utk baca link_type BARIS INI.
                    $rowIndex = explode('.', $attribute)[1] ?? null;
                    $linkType = $this->input("widgets.{$rowIndex}.config.link_type");

                    if ($linkType === 'menu_item') {
                        return; // divalidasi exists-nya di validateMenuItemLinks()
                    }
                    if ($linkType !== 'url') {
                        return; // link_type lain (mis. belum diisi) — tidak relevan
                    }

                    if (! preg_match('#^(https?://|/)#i', $value)) {
                        $fail('Link harus diawali http://, https://, atau /');

                        return;
                    }

                    // Defense in depth — regex di atas sudah menolak skema
                    // selain http(s)/relatif, baris ini menjaga niat validasi
                    // tetap jelas terbaca kalau kelak regex-nya diubah.
                    if (preg_match('#^\s*(javascript|data|vbscript):#i', $value)) {
                        $fail('Skema link tidak diizinkan.');
                    }
                },
            ],
        ];
    }

    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator) {
            $this->validateMenuItemLinks($validator);
            $this->validateNestingDepth($validator);
        });
    }

    /**
     * `link_type = menu_item` -> `link_to` harus id MenuItem yang ada
     * (Requirement 2.11). Dicek manual (bukan Rule::exists di rules())
     * karena rule-nya conditional pada sibling field `link_type`.
     */
    private function validateMenuItemLinks(Validator $validator): void {
        foreach ($this->input('widgets', []) as $idx => $row) {
            $linkType = $row['config']['link_type'] ?? null;
            $linkTo   = $row['config']['link_to'] ?? null;

            if ($linkType !== 'menu_item' || empty($linkTo)) {
                continue;
            }

            $exists = MenuItem::query()->whereKey($linkTo)->exists();
            if (! $exists) {
                $validator->errors()->add("widgets.$idx.config.link_to", 'MenuItem tidak ditemukan.');
            }
        }
    }

    /**
     * Requirement 1.6-1.11: validasi depth-aware berbasis DashboardWidget::VALID_PARENTS.
     * Membangun peta ref->type dulu (butuh tau TIPE parent untuk mengecek
     * VALID_PARENTS row anaknya), lalu jalan sekali lagi mengecek tiap row.
     *
     * Cukup validasi tiap baris individual terhadap VALID_PARENTS — karena
     * section (satu2nya tipe yang boleh jadi grandparent lewat link_card)
     * SELALU wajib root (VALID_PARENTS['section'] = []), kombinasi manapun
     * yang mencoba bikin kedalaman >2 otomatis gagal pada SALAH SATU baris
     * dalam rantai tersebut — tidak perlu walk rekursif terpisah.
     */
    private function validateNestingDepth(Validator $validator): void {
        $rows = $this->input('widgets', []);

        $typeByRef = collect($rows)
            ->filter(fn ($row) => ! empty($row['ref']))
            ->mapWithKeys(fn ($row) => [$row['ref'] => $row['type'] ?? null]);

        foreach ($rows as $idx => $row) {
            $type         = $row['type'] ?? null;
            $parentRef    = $row['parent_ref'] ?? null;
            $validParents = DashboardWidget::VALID_PARENTS[$type] ?? [];

            if (empty($parentRef)) {
                $ok = in_array(null, $validParents, true);
            } else {
                $parentType = $typeByRef->get($parentRef);
                $ok         = $parentType !== null && in_array($parentType, $validParents, true);
            }

            if (! $ok) {
                $parentDescription = empty($parentRef) ? 'root' : ($typeByRef->get($parentRef) ?? 'tidak dikenal');
                $validator->errors()->add(
                    "widgets.$idx.parent_ref",
                    "Block bertipe '{$type}' tidak boleh berada di dalam '{$parentDescription}'.",
                );
            }
        }
    }
}
