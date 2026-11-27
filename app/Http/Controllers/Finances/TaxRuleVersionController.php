<?php

namespace App\Http\Controllers\Finances;

use App\Exceptions\Finances\InvalidTaxRuleVersionException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\TaxRuleVersionRequest;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Services\Finances\Tax\TaxRuleVersionService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Aksi versi aturan pajak dari tab "Versi Aturan" pada halaman master Pajak (Finance Fase 3, Requirement 2 dan
 * 10.1): buat draft, ubah draft, hapus draft, aktifkan, dan pensiunkan. Penampilan daftar ada di
 * `TaxesController::show()` (versi hanyalah tab di halaman Pajak).
 *
 * Izin: SEMUA aksi tulis mensyaratkan `manage_rule_versions` (Requirement 2.5, 13.3); izin `write` model ini tidak
 * memberi akses ke aksi apa pun di sini. Tiap aksi dikembalikan ke satu nama izin (bukan daftar, karena daftar
 * berarti "salah satu"). Nama metode sengaja bukan `store`/`update`/`destroy` agar tidak dipetakan kelas dasar ke
 * izin `create`/`write`/`delete` yang tidak berlaku. Seluruh penulisan lewat `TaxRuleVersionService` (model
 * `$guarded = ['*']`), versi harus milik pajak pada URL, dan penolakan domain menjadi galat validasi (422).
 */
class TaxRuleVersionController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, TaxRuleVersion::class);
    }

    protected function enforcePermission(string $method) {
        return match ($method) {
            'save', 'updateDraft', 'discard', 'activate', 'retire' => 'manage_rule_versions',
            default => parent::enforcePermission($method),
        };
    }

    public function save(TaxRuleVersionRequest $request, Tax $tax, TaxRuleVersionService $versions): RedirectResponse {
        $version = $this->guarded(fn (): TaxRuleVersion => $versions->createDraft($tax, $request->attributesForService()));

        return back()->with('success', __('finances/taxRuleVersion.messages.created', ['version' => $version->version]));
    }

    public function updateDraft(TaxRuleVersionRequest $request, Tax $tax, TaxRuleVersion $taxRuleVersion, TaxRuleVersionService $versions): RedirectResponse {
        $this->assertBelongsTo($tax, $taxRuleVersion);
        $version = $this->guarded(fn (): TaxRuleVersion => $versions->updateDraft($taxRuleVersion, $request->attributesForService()));

        return back()->with('success', __('finances/taxRuleVersion.messages.updated', ['version' => $version->version]));
    }

    public function discard(Tax $tax, TaxRuleVersion $taxRuleVersion, TaxRuleVersionService $versions): RedirectResponse {
        $this->assertBelongsTo($tax, $taxRuleVersion);
        $this->guarded(fn () => $versions->deleteDraft($taxRuleVersion));

        return back()->with('success', __('finances/taxRuleVersion.messages.discarded', ['version' => $taxRuleVersion->version]));
    }

    public function activate(Tax $tax, TaxRuleVersion $taxRuleVersion, TaxRuleVersionService $versions): RedirectResponse {
        $this->assertBelongsTo($tax, $taxRuleVersion);
        $version = $this->guarded(fn (): TaxRuleVersion => $versions->activate($taxRuleVersion));

        return back()->with('success', __('finances/taxRuleVersion.messages.activated', ['version' => $version->version]));
    }

    public function retire(Tax $tax, TaxRuleVersion $taxRuleVersion, TaxRuleVersionService $versions): RedirectResponse {
        $this->assertBelongsTo($tax, $taxRuleVersion);
        $version = $this->guarded(fn (): TaxRuleVersion => $versions->retire($taxRuleVersion));

        return back()->with('success', __('finances/taxRuleVersion.messages.retired', ['version' => $version->version]));
    }

    /**
     * Versi harus milik pajak pada URL: tanpa ini versi pajak lain dapat diaktifkan lewat URL pajak mana pun.
     */
    private function assertBelongsTo(Tax $tax, TaxRuleVersion $version): void {
        abort_unless($version->tax_id === $tax->getKey(), 404);
    }

    /**
     * Menjalankan aksi service dan menerjemahkan penolakan domain menjadi galat validasi (422) pada kunci `version`.
     *
     * @template T
     *
     * @param  callable(): T  $action
     * @return T
     */
    private function guarded(callable $action): mixed {
        try {
            return $action();
        } catch (InvalidTaxRuleVersionException $e) {
            throw ValidationException::withMessages(['version' => $e->getMessage()]);
        }
    }
}
