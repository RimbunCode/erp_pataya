<?php

namespace App\Services\Core\PrintTemplate;

use App\Models\Core\PrintTemplate;
use App\Traits\Submitable;

/**
 * Menyisipkan slot tanda tangan "Disetujui oleh" ke print template lama yang
 * belum memilikinya.
 *
 * Editor GrapesJS memuat kolom `template` (project JSON), bukan `html`, dan
 * menimpa `html` dari isi editor setiap kali disimpan. Karena itu slot
 * disisipkan ke KEDUANYA: `html` supaya langsung tercetak, `template` supaya
 * tidak hilang saat template dibuka-simpan di editor. Bila project JSON-nya
 * tidak berbentuk yang dikenali, hanya `html` yang diubah dan pemanggil
 * diberi tahu lewat `templateUpdated = false`.
 *
 * Kelas ini tidak menyimpan model; pemanggil yang memutuskan kapan `save()`.
 */
class ApprovalSignatureSlotInserter {
    /** Kata kunci helper; template yang sudah memuatnya dilewati (idempoten). */
    public const HELPER = 'approvalSignature';

    /** Keterangan di atas slot. */
    public const CAPTION = 'Disetujui oleh,';

    /** Ekspresi helper yang disisipkan. */
    public const EXPRESSION = '{{{approvalSignature showName=true}}}';

    /**
     * Alasan template dilewati, atau null bila layak disisipi.
     *
     * @return string|null kode alasan: letter_head, already_has_slot, empty_html, no_approval
     */
    public function skipReason(PrintTemplate $template): ?string {
        if ($template->is_letter_head) {
            return 'letter_head';
        }

        if (blank($template->html)) {
            return 'empty_html';
        }

        if (str_contains($template->html, self::HELPER)) {
            return 'already_has_slot';
        }

        // Slot untuk dokumen yang tidak punya approval tidak pernah terisi,
        // tetapi keterangannya tetap tercetak.
        $model = $template->model;
        if (! $model || ! class_exists($model) || ! \in_array(Submitable::class, class_uses_recursive($model), true)) {
            return 'no_approval';
        }

        return null;
    }

    /**
     * Sisipkan slot ke `html`, `css`, dan (bila bisa) `template`.
     *
     * @return array{templateUpdated: bool} templateUpdated false bila project
     *                                      JSON tidak ada atau bentuknya tidak dikenali
     */
    public function insert(PrintTemplate $template): array {
        $template->html = $this->insertIntoHtml($template->html);
        $template->css  = $this->appendCss($template->css);

        return ['templateUpdated' => $this->insertIntoProject($template)];
    }

    /**
     * Markup slot sebagaimana editor akan menuliskannya: pembungkus ber-class,
     * lalu keterangan, lalu komponen tanda tangan.
     */
    public function htmlBlock(): string {
        return '<div class="approval-slot">'
            . '<div class="approval-slot-inner">'
            . '<div class="approval-slot-caption">' . self::CAPTION . '</div>'
            . '<div class="gjs-signature-wrapper" data-gjs-type="approvalSignature" data-show-name="true">'
            . self::EXPRESSION
            . '</div>'
            . '</div>'
            . '</div>';
    }

    /**
     * Aturan CSS slot. Selector `body` dipakai dengan sengaja, sama seperti
     * seluruh CSS template lain: renderer mengganti kata itu menjadi `main`.
     */
    public function cssBlock(): string {
        return <<<'CSS'

body .approval-slot {
  text-align: right;
  margin-top: 32px;
}

body .approval-slot-inner {
  display: inline-block;
  text-align: center;
  min-width: 220px;
}

body .approval-slot-caption {
  font-size: 12px;
  margin-bottom: 4px;
}
CSS;
    }

    /**
     * Aturan CSS yang sama dalam bentuk `styles` project GrapesJS.
     *
     * @return array<int, array{selectors: array<int, string>, style: array<string, string>}>
     */
    public function projectStyles(): array {
        return [
            [
                'selectors' => ['approval-slot'],
                'style'     => [
                    'text-align' => 'right',
                    'margin-top' => '32px',
                ],
            ],
            [
                'selectors' => ['approval-slot-inner'],
                'style'     => [
                    'display'    => 'inline-block',
                    'text-align' => 'center',
                    'min-width'  => '220px',
                ],
            ],
            [
                'selectors' => ['approval-slot-caption'],
                'style'     => [
                    'font-size'     => '12px',
                    'margin-bottom' => '4px',
                ],
            ],
        ];
    }

    /**
     * Komponen slot dalam bentuk project JSON GrapesJS.
     *
     * @return array<string, mixed>
     */
    public function projectComponent(): array {
        return [
            'tagName'    => 'div',
            'classes'    => ['approval-slot'],
            'components' => [
                [
                    'tagName'    => 'div',
                    'classes'    => ['approval-slot-inner'],
                    'components' => [
                        [
                            'tagName'    => 'div',
                            'classes'    => ['approval-slot-caption'],
                            'components' => [
                                ['type' => 'textnode', 'content' => self::CAPTION],
                            ],
                        ],
                        [
                            'type'       => 'approvalSignature',
                            'attributes' => [
                                'class'         => 'gjs-signature-wrapper',
                                'data-gjs-type' => 'approvalSignature',
                                'showName'      => 'true',
                            ],
                        ],
                    ],
                ],
            ],
        ];
    }

    private function insertIntoHtml(string $html): string {
        $position = strripos($html, '</body>');

        if ($position === false) {
            return $html . "\n" . $this->htmlBlock();
        }

        return substr($html, 0, $position) . $this->htmlBlock() . "\n" . substr($html, $position);
    }

    private function appendCss(?string $css): string {
        $css ??= '';

        if (str_contains($css, '.approval-slot')) {
            return $css;
        }

        return rtrim($css) . "\n" . $this->cssBlock() . "\n";
    }

    /**
     * Tambahkan komponen ke project JSON bila bentuknya dikenali:
     * `pages[0].frames[0].component.components` berupa array.
     */
    private function insertIntoProject(PrintTemplate $template): bool {
        $project = $template->template;

        if (! \is_array($project)) {
            return false;
        }

        $components = $project['pages'][0]['frames'][0]['component']['components'] ?? null;

        if (! \is_array($components)) {
            return false;
        }

        $project['pages'][0]['frames'][0]['component']['components'][] = $this->projectComponent();

        $styles = \is_array($project['styles'] ?? null) ? $project['styles'] : [];
        $known  = collect($styles)->pluck('selectors')->flatten()->all();

        foreach ($this->projectStyles() as $rule) {
            if (! \in_array($rule['selectors'][0], $known, true)) {
                $styles[] = $rule;
            }
        }

        $project['styles']  = $styles;
        $template->template = $project;

        return true;
    }
}
