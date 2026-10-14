<?php

namespace App\Console\Commands\Core;

use App\Models\Core\PrintTemplate;
use App\Services\Core\PrintTemplate\ApprovalSignatureSlotInserter;
use Illuminate\Console\Command;

/**
 * Menyisipkan slot "Disetujui oleh" ke print template lama yang belum
 * memuat helper `approvalSignature`.
 *
 * Idempoten: template yang sudah memuat helper dilewati. Kop surat dan
 * template untuk model tanpa approval juga dilewati. Gunakan `--dry-run`
 * untuk melihat template mana yang akan disentuh tanpa mengubah apa pun.
 */
class InsertApprovalSignatureSlotCommand extends Command {
    protected $signature = 'print-templates:insert-approval-signature
        {--dry-run : Hanya laporkan template yang akan disentuh, tanpa menyimpan}
        {--only-default : Batasi ke template yang berstatus default}';
    protected $description = 'Sisipkan slot tanda tangan "Disetujui oleh" ke print template yang belum memuat approvalSignature';

    public function handle(ApprovalSignatureSlotInserter $inserter): int {
        $dryRun = (bool) $this->option('dry-run');

        $query = PrintTemplate::query()->orderBy('name');

        if ($this->option('only-default')) {
            $query->where('is_default', true);
        }

        $touched          = 0;
        $projectNotSynced = [];

        foreach ($query->get() as $template) {
            $reason = $inserter->skipReason($template);

            // Kop surat dan template yang sudah punya slot adalah keadaan
            // normal, bukan temuan; tidak dicetak per baris.
            if ($reason !== null) {
                if (! \in_array($reason, ['letter_head', 'already_has_slot'], true)) {
                    $this->line("  dilewati ({$reason}): {$template->name}");
                }

                continue;
            }

            if ($dryRun) {
                $hasProject = \is_array($template->template);
                $this->line('  akan disisipi: ' . $template->name . ($hasProject ? '' : ' (tanpa project GrapesJS, hanya html)'));
                $touched++;

                continue;
            }

            $result = $inserter->insert($template);
            $template->save();
            $touched++;

            $this->line('  disisipi: ' . $template->name);

            if (! $result['templateUpdated']) {
                $projectNotSynced[] = $template->name;
            }
        }

        if ($dryRun) {
            $this->info("Dry run: {$touched} template akan disisipi slot. Tidak ada yang diubah.");

            return self::SUCCESS;
        }

        $this->info("{$touched} template disisipi slot.");

        if ($projectNotSynced !== []) {
            $this->warn('Peringatan: project GrapesJS (kolom template) tidak dapat diubah untuk template berikut, hanya html yang disisipi:');

            foreach ($projectNotSynced as $name) {
                $this->warn("  - {$name}");
            }

            $this->warn('Editor membaca kolom template, bukan html. Buka template itu di editor, tambahkan blok Tanda Tangan, lalu simpan; jika tidak, slot hilang saat template disimpan dari editor.');
        }

        return self::SUCCESS;
    }
}
