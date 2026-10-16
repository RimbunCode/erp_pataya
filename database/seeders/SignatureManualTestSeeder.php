<?php

namespace Database\Seeders;

use App\Models\Core\ApprovalScheme;
use App\Models\Core\ApprovalSchemeStep;
use App\Models\Core\PrintTemplate;
use App\Models\Finances\SalesInvoice;
use App\Models\User\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Menyiapkan lingkungan uji manual untuk fitur tanda tangan approval.
 *
 * SEKALI PAKAI, khusus mesin pengembangan. Tidak dipanggil DatabaseSeeder
 * dan tidak dimaksudkan untuk staging apalagi produksi: ia mengubah scheme
 * approval yang ada dan menyisipkan slot tanda tangan ke print template.
 *
 * Alasan keberadaannya: seluruh scheme aktif di basis data lokal hanya punya
 * SATU step, sehingga aturan inti fitur ini (hanya penandatangan final yang
 * tercetak) tidak bisa dibuktikan dengan mata. Seeder ini menaikkannya jadi
 * tiga step dengan role berbeda.
 *
 * Jalankan:
 *   php artisan db:seed --class=SignatureManualTestSeeder
 *
 * Kembalikan seperti semula:
 *   php artisan db:seed --class=SignatureManualTestSeeder --no-interaction -- --undo
 *   (atau panggil `rollback()` lewat tinker)
 */
class SignatureManualTestSeeder extends Seeder {
    /**
     * Penanda pada nama step buatan seeder ini, supaya rollback tahu persis
     * mana yang boleh dihapus dan tidak menyentuh step asli.
     */
    private const MARKER = '[uji-ttd]';

    private const SLOT_HTML = <<<'HTML'
<div class="signature-slot" style="margin-top:32px;text-align:right;">
  <div style="display:inline-block;text-align:center;min-width:220px;">
    <div style="font-size:12px;margin-bottom:4px;">Disetujui oleh,</div>
    {{{approvalSignature showName=true showDate=true}}}
  </div>
</div>
HTML;

    public function run(): void {
        DB::transaction(function () {
            $this->seedApprovalSteps();
            $this->seedPrintTemplateSlot();
        });

        $this->command?->info('Siap. Lihat ringkasan langkah uji di bawah.');
        $this->printInstructions();
    }

    /**
     * Naikkan scheme Sales Invoice menjadi tiga step berurutan.
     *
     * Step pertama yang sudah ada dibiarkan apa adanya; yang ditambahkan
     * hanya sequence 1 dan 2, masing-masing dengan role berbeda supaya
     * approval benar-benar berpindah tangan.
     */
    private function seedApprovalSteps(): void {
        $scheme = ApprovalScheme::where('model', SalesInvoice::class)
            ->where('is_active', true)
            ->first();

        if (! $scheme) {
            $this->command?->warn('Scheme Sales Invoice tidak ditemukan, langkah approval dilewati.');

            return;
        }

        $roles = Role::whereIn('name', ['Approver', 'Finance Officer', 'System Manager'])
            ->pluck('id', 'name');

        $wanted = [
            1 => $roles['Finance Officer'] ?? null,
            2 => $roles['System Manager'] ?? null,
        ];

        foreach ($wanted as $sequence => $roleId) {
            if (! $roleId) {
                continue;
            }

            $exists = ApprovalSchemeStep::where('approval_scheme_id', $scheme->id)
                ->where('sequence', $sequence)
                ->exists();

            if ($exists) {
                continue;
            }

            ApprovalSchemeStep::create([
                'approval_scheme_id' => $scheme->id,
                'sequence'           => $sequence,
                'approver_type'      => 'role',
                'approverable_id'    => $roleId,
                'approverable_type'  => Role::class,
                'is_advanced'        => false,
                'config'             => ['note' => self::MARKER],
            ]);
        }

        $total = ApprovalSchemeStep::where('approval_scheme_id', $scheme->id)->count();
        $this->command?->info("Scheme '{$scheme->name}' sekarang punya {$total} step.");
    }

    /**
     * Sisipkan slot tanda tangan ke print template Sales Invoice.
     *
     * Disisipkan tepat sebelum </body> supaya tidak mengganggu tata letak
     * yang sudah ada.
     */
    private function seedPrintTemplateSlot(): void {
        $template = PrintTemplate::where('model', SalesInvoice::class)
            ->where('is_default', true)
            ->first();

        if (! $template) {
            $this->command?->warn('Print template Sales Invoice tidak ditemukan, slot dilewati.');

            return;
        }

        if (str_contains((string) $template->html, 'approvalSignature')) {
            $this->command?->info('Slot tanda tangan sudah ada di template, dilewati.');

            return;
        }

        $html = (string) $template->html;
        $slot = self::SLOT_HTML;

        $template->html = str_contains($html, '</body>')
            ? str_replace('</body>', $slot . '</body>', $html)
            : $html . $slot;

        $template->save();

        $this->command?->info("Slot tanda tangan disisipkan ke '{$template->name}'.");
    }

    /**
     * Kembalikan perubahan seeder ini.
     */
    public function rollback(): void {
        DB::transaction(function () {
            $scheme = ApprovalScheme::where('model', SalesInvoice::class)->first();

            if ($scheme) {
                ApprovalSchemeStep::where('approval_scheme_id', $scheme->id)
                    ->where('sequence', '>', 0)
                    ->get()
                    ->each(function (ApprovalSchemeStep $step) {
                        // Hanya step bertanda seeder ini yang dihapus.
                        if (($step->config['note'] ?? null) === self::MARKER) {
                            $step->forceDelete();
                        }
                    });
            }

            $template = PrintTemplate::where('model', SalesInvoice::class)
                ->where('is_default', true)
                ->first();

            if ($template && str_contains((string) $template->html, 'approvalSignature')) {
                $template->html = str_replace(self::SLOT_HTML, '', (string) $template->html);
                $template->save();
            }
        });
    }

    private function printInstructions(): void {
        $lines = [
            '',
            '── Langkah uji manual ──────────────────────────────',
            '1. Login admin/admin, buka profilmu, unggah atau gambar tanda tangan.',
            '2. Buat Sales Invoice baru, lalu Submit.',
            '3. Approve TIGA kali (step 1 Approver, step 2 Finance Officer,',
            '   step 3 System Manager). Akun admin memegang semua role.',
            '4. Setelah approval terakhir, buka tab Files pada dokumen itu:',
            '   PDF hasil approval muncul di sana.',
            '5. Yang harus terlihat: HANYA SATU tanda tangan, milik penyetuju',
            '   terakhir. Nama dan tanggal ikut tercetak di bawahnya.',
            '',
            'Bandingkan: hapus tanda tanganmu di profil, approve dokumen lain,',
            'slot harus berisi nama + tanggal dalam bentuk teks, bukan kosong.',
            '────────────────────────────────────────────────────',
        ];

        foreach ($lines as $line) {
            $this->command?->line($line);
        }
    }
}
