<?php

namespace Database\Seeders\PrintTemplates;

use App\Models\Core\PrintTemplate;
use App\Services\Core\PrintTemplate\PrintTemplateProjectBuilder;

/**
 * Kop surat default yang dipakai bersama oleh seluruh template cetak standar.
 *
 * Identitas perusahaan (nama, alamat, telepon, email) hanya tercetak di kop
 * surat; body dokumen tidak mengulanginya. Karena itu setiap template standar
 * harus punya kop surat, dan seeder memastikannya ada lewat kelas ini.
 */
final class DefaultLetterHead {
    public const NAME = 'Kop Surat Default';

    /**
     * Id kop surat default. Dibuat hanya bila belum ada satu pun kop surat;
     * kop surat yang sudah ada (buatan pengguna) tidak pernah ditimpa. Bila
     * sudah ada kop surat tetapi tidak ada yang berstatus default, tidak ada
     * yang dipilih (mengembalikan null) supaya pilihan pengguna tetap dihormati.
     */
    public static function ensure(): ?string {
        $defaultId = PrintTemplate::where('is_letter_head', true)
            ->where('is_default', true)
            ->value('id');

        if ($defaultId !== null) {
            return $defaultId;
        }

        if (PrintTemplate::where('is_letter_head', true)->exists()) {
            return null;
        }

        $html = self::html();
        $css  = self::css();

        $letterHead = new PrintTemplate;
        $letterHead->fill([
            'name'                 => self::NAME,
            'is_letter_head'       => true,
            'is_default'           => true,
            'default_language'     => 'id',
            'html'                 => $html,
            'css'                  => $css,
            'template'             => app(PrintTemplateProjectBuilder::class)->build($html, $css),
            'paper'                => 'A4',
            'orientation'          => 'portrait',
            'width'                => 21,
            'height'               => 29.7,
            'margin_top'           => 1.5,
            'margin_bottom'        => 1.5,
            'margin_left'          => 1.5,
            'margin_right'         => 1.5,
            'unit'                 => 'cm',
            'show_absolute_values' => false,
        ]);
        $letterHead->save();

        return $letterHead->id;
    }

    /**
     * Tata letak memakai tabel HTML karena dompdf (cadangan wkhtmltopdf) tidak
     * mendukung flex maupun grid.
     */
    public static function html(): string {
        return <<<'HTML'
<body>
  <div class="letterhead">
    <div class="letterhead-contact-cell">
      <p class="letterhead-contact">{{companyDetail "phone"}}</p>
      <p class="letterhead-contact">{{companyDetail "email"}}</p>
    </div>
    <div class="letterhead-main">
      <p class="letterhead-company-name">{{companyDetail "company_name"}}</p>
      <p class="letterhead-address">{{companyDetail "street"}}, {{companyDetail "city"}}, {{companyDetail "state"}} {{companyDetail "zip_code"}}</p>
      <p class="letterhead-address">{{companyDetail "country_name"}}</p>
    </div>
    <div class="letterhead-clear"></div>
  </div>
</body>

HTML;
    }

    /**
     * Jangan menaruh komentar CSS di string ini: pelingkup selector memotong
     * teks sebelum `{` pada koma, jadi komentar berkoma merusak aturan di
     * bawahnya dan aturan itu dibuang browser.
     */
    public static function css(): string {
        return <<<'CSS'
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11px;
  color: #1a1a1a;
  line-height: 1.35;
}

body .letterhead {
  padding-bottom: 8px;
  border-bottom: 2px solid #1a1a1a;
  margin-bottom: 14px;
}

body .letterhead-contact-cell {
  float: right;
  width: 35%;
  text-align: right;
}

body .letterhead-clear {
  clear: both;
}

body .letterhead p {
  margin: 0;
}

body .letterhead-company-name {
  font-size: 18px;
  font-weight: bold;
  text-transform: uppercase;
  margin: 0 0 3px 0;
}

body .letterhead-address {
  font-size: 10px;
  color: #333333;
}

body .letterhead-contact {
  font-size: 10px;
  color: #333333;
  text-align: right;
}
CSS;
    }
}
