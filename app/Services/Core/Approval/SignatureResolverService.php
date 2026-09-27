<?php

namespace App\Services\Core\Approval;

use App\Enums\FormStatus;
use App\Models\Core\ApprovalInstanceStep;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/**
 * Menentukan siapa penandatangan final sebuah dokumen dan mengambil berkas
 * tanda tangannya (FR8a).
 *
 * Dipakai bersama oleh helper Handlebars sisi server dan controller yang
 * menyiapkan data pratinjau, supaya aturan "siapa yang tanda tangannya
 * tercetak" hanya ada di satu tempat.
 */
class SignatureResolverService {
    /**
     * Resolusi tanda tangan penandatangan final.
     *
     * @return array{
     *     image: string|null,
     *     name: string|null,
     *     date: string|null,
     *     hasSignature: bool
     * }|null null bila dokumen belum punya step approved sama sekali
     */
    public function resolveFinalSignature(Model $document): ?array {
        $step = $this->resolveFinalStep($document);

        if ($step === null) {
            return null;
        }

        $signer = $step->actedBy;
        $image  = $this->readSignatureDataUri($signer);

        return [
            'image'        => $image,
            'name'         => $signer?->name,
            'date'         => $step->acted_at?->translatedFormat('d F Y'),
            'hasSignature' => $image !== null,
        ];
    }

    /**
     * Step yang tanda tangannya dipakai: step berstatus APPROVED dengan
     * `sequence` TERBESAR.
     *
     * Bukan sekadar `sequence` terbesar dari SELURUH step. Keduanya memberi
     * jawaban sama hanya ketika semua step approved; begitu ada step
     * WAITING (approval belum selesai) atau SKIPPED (auto-approve), yang
     * kedua menunjuk step tanpa penandatangan dan tanda tangan yang
     * sebenarnya ada justru terlewat.
     */
    public function resolveFinalStep(Model $document): ?ApprovalInstanceStep {
        $instance = $document->approvalable;

        if ($instance === null) {
            return null;
        }

        return $instance->steps
            ->filter(function (ApprovalInstanceStep $step): bool {
                // acted_by_id NULL bukan sekadar jaga-jaga: step bisa
                // berstatus APPROVED tanpa pelaku pada data lama, dan tanpa
                // saringan ini resolver memilih step tak bertanda tangan
                // lalu jatuh ke fallback, alih-alih memakai step sebelumnya
                // yang penandatangannya ada.
                return $step->status?->value === FormStatus::APPROVED->value
                    && $step->acted_by_id !== null;
            })
            ->sortByDesc('sequence')
            ->first();
    }

    /**
     * Baca berkas tanda tangan dari storage sebagai data URI base64 (FR7).
     *
     * Bukan URL: renderer PDF berjalan tanpa sesi login, sehingga route
     * tanda tangan yang terproteksi akan gagal dimuat dan slot-nya kosong
     * di PDF hasil.
     */
    private function readSignatureDataUri(?Model $signer): ?string {
        $file = $signer?->signatureFile;

        if ($file === null || ! $file->path || ! Storage::exists($file->path)) {
            return null;
        }

        $bytes = Storage::get($file->path);

        if ($bytes === null || $bytes === '') {
            return null;
        }

        return 'data:image/png;base64,' . base64_encode($bytes);
    }
}
