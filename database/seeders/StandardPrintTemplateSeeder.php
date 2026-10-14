<?php

namespace Database\Seeders;

use App\Models\Core\PrintTemplate;
use App\Models\User\Permission;
use App\Services\Core\PrintTemplate\PrintTemplateProjectBuilder;
use Database\Seeders\PrintTemplates\Asset\AssetTemplates;
use Database\Seeders\PrintTemplates\CRM\CrmTemplates;
use Database\Seeders\PrintTemplates\Finances\FinancesTemplates;
use Database\Seeders\PrintTemplates\Inventory\InventoryTemplates;
use Database\Seeders\PrintTemplates\Purchase\PurchaseTemplates;
use Database\Seeders\PrintTemplates\Sales\SalesTemplates;
use Database\Seeders\PrintTemplates\Service\ServiceTemplates;
use Database\Seeders\PrintTemplates\TemplateParts;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Satu template cetak "Standar" untuk tiap dari 16 model Submitable, masing-
 * masing dengan dua slot tanda tangan berdampingan: "Dibuat oleh"
 * (`role="creator"`) dan "Disetujui oleh" (`role="approver"`).
 *
 * Idempoten: dicocokkan berdasar `name`, aman dijalankan ulang. Template
 * "Default - ..." yang dibuat tangan TIDAK disentuh: nama template di sini
 * sengaja berbeda, dan seeder ini tidak pernah menimpa template lain.
 *
 * Seeder ini tidak mengisi `is_default`. Bila template ini ternyata satu-
 * satunya template untuk modelnya, hook `PrintTemplate::saving` yang
 * menjadikannya default (pengaman supaya halaman cetak tidak kehilangan
 * template); bila sudah ada template lain, status default-nya tidak berubah.
 *
 * Kop surat TIDAK ditulis ulang di sini: dipakai kop surat default yang ada
 * lewat `letter_head_id`.
 *
 * Markup tiap dokumen ada di `Database\Seeders\PrintTemplates\{Domain}`.
 */
class StandardPrintTemplateSeeder extends Seeder {
    /** Pola nama template; dibedakan jelas dari "Default - ...". */
    public const NAME_PATTERN = 'Standar - %s (dengan Dibuat oleh)';

    /**
     * Nama template untuk sebuah label dokumen.
     */
    public static function nameFor(string $label): string {
        return sprintf(self::NAME_PATTERN, $label);
    }

    /**
     * Seluruh definisi template, urut per domain.
     *
     * @return array<int, array{model: class-string, label: string, relations: array<int, string>, html: string}>
     */
    public static function definitions(): array {
        return [
            ...SalesTemplates::definitions(),
            ...CrmTemplates::definitions(),
            ...InventoryTemplates::definitions(),
            ...PurchaseTemplates::definitions(),
            ...FinancesTemplates::definitions(),
            ...AssetTemplates::definitions(),
            ...ServiceTemplates::definitions(),
        ];
    }

    public function run(): void {
        $projectBuilder = app(PrintTemplateProjectBuilder::class);
        $css            = TemplateParts::css();
        $letterHeadId   = PrintTemplate::where('is_letter_head', true)
            ->where('is_default', true)
            ->value('id');

        foreach (self::definitions() as $definition) {
            $permission = Permission::where('model', $definition['model'])->first();

            $template = PrintTemplate::where('name', self::nameFor($definition['label']))->first()
                ?? new PrintTemplate;

            $template->fill([
                'name'                 => self::nameFor($definition['label']),
                'model'                => $definition['model'],
                'name_model'           => $permission?->name ?? Str::plural($definition['label']),
                'permission_id'        => $permission?->id,
                'is_letter_head'       => false,
                'letter_head_id'       => $letterHeadId,
                'default_language'     => 'id',
                'html'                 => $definition['html'],
                'css'                  => $css,
                'template'             => $projectBuilder->build($definition['html'], $css),
                'used_relations'       => $definition['relations'],
                'paper'                => $template->paper ?? 'A4',
                'orientation'          => $template->orientation ?? 'portrait',
                'width'                => $template->width ?? 21,
                'height'               => $template->height ?? 29.7,
                'margin_top'           => $template->margin_top ?? 1.5,
                'margin_bottom'        => $template->margin_bottom ?? 1.5,
                'margin_left'          => $template->margin_left ?? 1.5,
                'margin_right'         => $template->margin_right ?? 1.5,
                'unit'                 => $template->unit ?? 'cm',
                'font_family'          => $template->font_family ?? 'Arial',
                'page_number'          => $template->page_number ?? 'bottom_right',
                'page_number_format'   => $template->page_number_format ?? ':page / :total',
                'show_absolute_values' => false,
            ]);
            $template->save();
        }
    }
}
