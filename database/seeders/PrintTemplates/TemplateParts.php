<?php

namespace Database\Seeders\PrintTemplates;

/**
 * Potongan markup bersama untuk template cetak standar.
 *
 * Hanya kerangka yang dipakai bersama (judul, tabel meta, tabel barang,
 * total, termin, tanda tangan). Isi tiap dokumen, yaitu kolom dan
 * field-nya, ditentukan oleh kelas domain masing-masing dan berbeda per jenis.
 *
 * Tata letak memakai tabel HTML dan bukan grid/flex: template ini dicetak
 * lewat wkhtmltopdf dengan fallback dompdf, dan dompdf tidak mendukung
 * keduanya.
 *
 * Kata "body" HANYA boleh muncul sebagai pembungkus dokumen dan selector
 * CSS: renderer mengganti kata itu menjadi "main" (dokumen) atau "div"
 * (kop surat) secara literal.
 */
final class TemplateParts {
    public static function css(): string {
        return <<<'CSS'
/*
 * CSS template cetak standar (dengan slot tanda tangan Dibuat oleh dan
 * Disetujui oleh). Selector memakai tag pembungkus dokumen dengan sengaja:
 * saat dirender, kata itu diganti literal menjadi "main", jadi kata tersebut
 * tidak boleh dipakai di tempat lain pada berkas ini.
 */
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10px;
  color: #1a1a1a;
  line-height: 1.25;
}

body .doc-title {
  font-size: 15px;
  font-weight: bold;
  text-transform: uppercase;
  text-align: center;
  margin: 8px 0;
  letter-spacing: 1px;
}

body .meta-table {
  border-collapse: collapse;
  margin-bottom: 12px;
}

body .meta-table td {
  padding: 2px 4px 2px 0;
  vertical-align: top;
}

body .meta-label {
  width: 140px;
  color: #444444;
}

body .meta-sep {
  width: 12px;
}

body .party-block {
  margin-bottom: 12px;
}

body .party-title {
  font-weight: bold;
  text-transform: uppercase;
  font-size: 11px;
  color: #444444;
  margin-bottom: 4px;
  border-bottom: 1px solid #cccccc;
  padding-bottom: 2px;
}

body .party-name {
  font-weight: bold;
  font-size: 13px;
  margin: 0 0 2px 0;
}

body .party-block p {
  margin: 0 0 2px 0;
}

body .section-title {
  font-weight: bold;
  margin: 12px 0 4px 0;
}

body .items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 8px;
  table-layout: fixed;
}

body .items-table th {
  background-color: #f0f0f0;
  border: 1px solid #999999;
  padding: 4px 3px;
  font-size: 8px;
  text-transform: uppercase;
  text-align: left;
}

body .items-table td {
  border: 1px solid #cccccc;
  padding: 4px 3px;
  font-size: 9px;
  vertical-align: top;
  overflow-wrap: anywhere;
}

body .items-table .col-no {
  width: 30px;
  text-align: center;
}

body .items-table .col-qty,
body .items-table .col-number {
  text-align: right;
}

body .items-table th:first-child,
body .items-table td:first-child {
  width: 46%;
}

body .items-table th:nth-child(2),
body .items-table td:nth-child(2) {
  width: 14%;
}

body .items-table th:nth-child(3),
body .items-table td:nth-child(3) {
  width: 20%;
}

body .items-table th:nth-child(4),
body .items-table td:nth-child(4) {
  width: 20%;
}

body .totals-table {
  border-collapse: collapse;
  min-width: 260px;
  margin-bottom: 12px;
}

body .totals-table td {
  padding: 4px 6px;
  font-size: 12px;
}

body .totals-table .totals-label {
  text-align: left;
  color: #444444;
}

body .totals-table .totals-value {
  text-align: right;
  font-weight: bold;
}

body .totals-table .grand-total td {
  border-top: 2px solid #1a1a1a;
  font-size: 14px;
  padding-top: 6px;
}

body .clear {
  clear: both;
}

body .note-block {
  margin: 8px 0;
  font-size: 11px;
  color: #444444;
  white-space: pre-line;
}

body .pre-line {
  white-space: pre-line;
}

body .letter-section {
  margin-top: 12px;
  page-break-inside: avoid;
}

body .letter-section-title {
  font-weight: bold;
  margin-bottom: 2px;
}

body .letter-section-content {
  white-space: pre-line;
}

body .approval-signatures {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  page-break-inside: avoid;
}

body .approval-signatures td {
  width: 50%;
  text-align: center;
  vertical-align: top;
  padding: 0 8px;
}

body .approval-signature-caption {
  font-size: 10px;
  margin-bottom: 4px;
}

body .approval-signature {
  display: inline-block;
  text-align: center;
}

body .approval-signature img {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  max-height: 58px !important;
}

body .doc-title-right {
  text-align: right;
  margin: 4px 0 12px 0;
}

body .doc-title-left {
  text-align: left;
  margin: 0;
}

body .title-bar {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
}

body .title-bar td {
  vertical-align: top;
  padding: 0;
}

body .header-columns {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 14px;
}

body .header-columns td.header-col {
  vertical-align: top;
  padding: 0 8px 0 0;
}

body .header-columns td.header-col-fixed {
  width: 31%;
}

body .header-columns td.header-col-fixed:last-child {
  width: 38%;
}

body .header-columns td.header-col:last-child {
  padding-right: 0;
}

body .header-columns td.header-col-right {
  vertical-align: top;
  text-align: right;
  padding: 0;
}

body .header-block p {
  margin: 0 0 1px 0;
}

body .party-heading {
  font-weight: bold;
  font-size: 10px;
  margin: 0 0 3px 0;
}

body .meta-table-right {
  border-collapse: collapse;
  margin-left: auto;
  margin-bottom: 0;
}

body .meta-table-right td {
  padding: 2px 0 2px 4px;
  vertical-align: top;
  text-align: right;
}

body .meta-table-right .meta-label {
  width: auto;
  color: #1a1a1a;
  font-weight: bold;
  padding-right: 4px;
}

body .meta-table-right .meta-sep {
  width: 10px;
  text-align: center;
}

body .items-table tr.summary-row td {
  font-weight: bold;
  padding: 6px;
}

body .items-table td.summary-label {
  text-align: right;
}

body .items-table td.summary-value {
  text-align: right;
}

body .items-table tr.summary-grand-total td {
  background-color: #e6e6e6;
  font-weight: bold;
  border-top: 2px solid #1a1a1a;
}

body .note-inline {
  margin: 8px 0 12px 0;
  font-size: 12px;
}

body .framed-box {
  border: 1px solid #1a1a1a;
  padding: 8px 12px;
  margin: 10px 0;
  display: inline-block;
  min-width: 260px;
  page-break-inside: avoid;
}

body .framed-box p {
  margin: 0 0 2px 0;
}

body .manual-signature-space {
  min-height: 64px;
}

body .manual-signature-line {
  border-bottom: 1px solid #1a1a1a;
  width: 80%;
  margin: 0 auto;
}
CSS;
    }

    /**
     * Judul dokumen sebagai teks literal, bukan `{{trans "..."}}`: helper
     * `trans` di sisi server memakai `__()` Laravel, yang tidak meresolusi
     * kunci bersarang seperti `sales.salesOrder.title` (file terjemahan
     * berada di subfolder), sehingga PDF hasil render server mencetak
     * kunci mentahnya.
     */
    public static function title(string $text): string {
        return '<div class="doc-title">' . $text . '</div>';
    }

    /**
     * Judul dokumen rata kanan untuk layout standar perusahaan (sejajar logo
     * pada kop surat). Tetap menyertakan class `doc-title` sebagai penanda utama.
     */
    public static function titleRight(string $text): string {
        return '  <div class="doc-title doc-title-right">' . $text . '</div>';
    }

    /**
     * Baris judul di kiri dan meta dokumen di kanan atas (dipakai Sales Order
     * dan Internal Order).
     *
     * @param  array<int, array{0: string, 1: string, 2?: string}>  $metaRows
     */
    public static function titleBar(string $text, array $metaRows): string {
        return "  <table class=\"title-bar\">\n"
            . "    <tr>\n"
            . '      <td><div class="doc-title doc-title-left">' . $text . "</div></td>\n"
            . "      <td class=\"header-col-right\">\n" . self::metaRight($metaRows) . "\n      </td>\n"
            . "    </tr>\n"
            . '  </table>';
    }

    /**
     * Tabel "label : nilai". Baris dengan kunci ketiga hanya tercetak bila
     * field itu terisi.
     *
     * @param  array<int, array{0: string, 1: string, 2?: string}>  $rows  [label, ekspresi, field syarat]
     */
    public static function meta(array $rows): string {
        $lines = [];

        foreach ($rows as $row) {
            $line = '<tr><td class="meta-label">' . $row[0] . '</td><td class="meta-sep">:</td><td>' . $row[1] . '</td></tr>';

            if (isset($row[2])) {
                $line = '{{#if ' . $row[2] . '}}' . $line . '{{/if}}';
            }

            $lines[] = '      ' . $line;
        }

        return "  <table class=\"meta-table\">\n    <tbody>\n" . implode("\n", $lines) . "\n    </tbody>\n  </table>";
    }

    /**
     * Tabel "label : nilai" rata kanan untuk kolom paling kanan pada header.
     *
     * @param  array<int, array{0: string, 1: string, 2?: string}>  $rows  [label, ekspresi, field syarat]
     */
    public static function metaRight(array $rows): string {
        $lines = [];

        foreach ($rows as $row) {
            $line = '<tr><td class="meta-label">' . $row[0] . '</td><td class="meta-sep">:</td><td>' . $row[1] . '</td></tr>';

            if (isset($row[2])) {
                $line = '{{#if ' . $row[2] . '}}' . $line . '{{/if}}';
            }

            $lines[] = '      ' . $line;
        }

        return "  <table class=\"meta-table-right\" align=\"right\">\n    <tbody>\n" . implode("\n", $lines) . "\n    </tbody>\n  </table>";
    }

    /**
     * Susunan kolom sejajar di bagian kepala dokumen (umumnya 3 kolom:
     * identitas perusahaan, pihak lawan, dan meta rata kanan).
     *
     * @param  array<int, string|array{content: string, class?: string, width?: string}>  $columns
     */
    public static function headerColumns(array $columns): string {
        $count = \count($columns);
        $cells = [];

        foreach ($columns as $index => $col) {
            $isLast  = $index === $count - 1;
            $content = \is_array($col) ? $col['content'] : $col;
            $class   = \is_array($col) && isset($col['class'])
                ? $col['class']
                : ($isLast ? 'header-col header-col-fixed header-col-right' : 'header-col header-col-fixed');
            $widthAttr = \is_array($col) && isset($col['width']) ? ' style="width:' . $col['width'] . ';"' : '';
            $cells[]   = "      <td class=\"{$class}\"{$widthAttr}>\n{$content}\n      </td>";
        }

        return "  <table class=\"header-columns\">\n    <tr>\n" . implode("\n", $cells) . "\n    </tr>\n  </table>";
    }

    /**
     * Blok identitas perusahaan di kolom kiri header, diambil dari preferences.
     */
    public static function companyBlock(): string {
        return "        <div class=\"header-block\">\n"
            . "          <p class=\"party-name\">{{companyDetail \"company_name\"}}</p>\n"
            . "          <p>{{companyDetail \"street\"}}</p>\n"
            . "          <p>{{companyDetail \"city\"}} {{companyDetail \"state\"}}</p>\n"
            . "          <p>{{companyDetail \"country\"}} {{companyDetail \"zip_code\"}}</p>\n"
            . "          <p>{{companyDetail \"phone\"}}</p>\n"
            . "          <p>{{companyDetail \"email\"}}</p>\n"
            . '        </div>';
    }

    /**
     * Blok pihak lawan (Supplier, Customer, dsb.) untuk kolom tengah header.
     *
     * @param  string  $path  mis. `doc.supplier` atau `doc.customer`
     * @param  array<int, string>  $extraLines  baris tambahan di bawah email (mis. NPWP)
     */
    public static function partyBlock(string $path, ?string $title = null, array $extraLines = []): string {
        $heading = ($title !== null && $title !== '')
            ? "          <div class=\"party-heading\">{$title}</div>\n"
            : '';

        $extras = '';
        foreach ($extraLines as $line) {
            $extras .= "          <p>{$line}</p>\n";
        }

        return "        <div class=\"header-block\">\n"
            . $heading
            . "          <p class=\"party-name\">{{{$path}.name}}</p>\n"
            . "          <p>{{{$path}.street}}</p>\n"
            . "          <p>{{{$path}.city}} {{{$path}.province}} {{{$path}.zip_code}}</p>\n"
            . "          <p>{{{$path}.phone}}</p>\n"
            . "          <p>{{{$path}.email}}</p>\n"
            . $extras
            . '        </div>';
    }

    /**
     * Blok Bill To yang mengikuti aturan `customer_branch`: bila cabang punya
     * alamat tagih terpisah (`billing_street`), pakai itu; bila tidak tetapi
     * punya alamat kirim (`shipping_street`, yaitu `same_shipping`), pakai
     * alamat kirim; selain itu jatuh ke alamat utama `customer`.
     */
    public static function billToBlock(
        string $customerPath = 'doc.customer',
        ?string $branchPath = 'doc.customer_branch',
        string $title = 'Bill To',
    ): string {
        if ($branchPath === null) {
            return self::partyBlock($customerPath, $title, ["{{{$customerPath}.vat}}"]);
        }

        return "        <div class=\"header-block\">\n"
            . "          <div class=\"party-heading\">{$title}</div>\n"
            . "          <p class=\"party-name\">{{{$customerPath}.name}}</p>\n"
            . "          {{#if {$branchPath}.billing_street}}\n"
            . "          <p>{{{$branchPath}.billing_street}}</p>\n"
            . "          <p>{{{$branchPath}.billing_city}} {{{$branchPath}.billing_state}} {{{$branchPath}.billing_zip_code}}</p>\n"
            . "          {{else}}\n"
            . "          {{#if {$branchPath}.shipping_street}}\n"
            . "          <p>{{{$branchPath}.shipping_street}}</p>\n"
            . "          <p>{{{$branchPath}.shipping_city}} {{{$branchPath}.shipping_state}} {{{$branchPath}.shipping_zip_code}}</p>\n"
            . "          {{else}}\n"
            . "          <p>{{{$customerPath}.street}}</p>\n"
            . "          <p>{{{$customerPath}.city}} {{{$customerPath}.province}} {{{$customerPath}.zip_code}}</p>\n"
            . "          {{/if}}\n"
            . "          {{/if}}\n"
            . "          <p>{{{$customerPath}.phone}}</p>\n"
            . "          <p>{{{$customerPath}.email}}</p>\n"
            . "          <p>{{{$customerPath}.vat}}</p>\n"
            . '        </div>';
    }

    /**
     * Blok Ship To yang memakai alamat pengiriman `customer_branch` dengan
     * fallback ke alamat utama `customer`.
     */
    public static function shipToBlock(
        string $customerPath = 'doc.customer',
        string $branchPath = 'doc.customer_branch',
        string $title = 'Ship To',
    ): string {
        return "        <div class=\"header-block\">\n"
            . "          <div class=\"party-heading\">{$title}</div>\n"
            . "          <p class=\"party-name\">{{{$customerPath}.name}}</p>\n"
            . "          {{#if {$branchPath}.shipping_street}}\n"
            . "          <p>{{{$branchPath}.shipping_street}}</p>\n"
            . "          <p>{{{$branchPath}.shipping_city}} {{{$branchPath}.shipping_state}} {{{$branchPath}.shipping_zip_code}}</p>\n"
            . "          {{else}}\n"
            . "          <p>{{{$customerPath}.street}}</p>\n"
            . "          <p>{{{$customerPath}.city}} {{{$customerPath}.province}} {{{$customerPath}.zip_code}}</p>\n"
            . "          {{/if}}\n"
            . "          <p>{{{$customerPath}.phone}}</p>\n"
            . '        </div>';
    }

    /**
     * Blok pihak (pelanggan atau pemasok).
     *
     * @param  string  $path  mis. `doc.customer`
     */
    public static function party(string $title, string $path): string {
        return '  <div class="party-block">'
            . '<div class="party-title">' . $title . '</div>'
            . '<p class="party-name">{{' . $path . '.name}}</p>'
            . '<p>{{' . $path . '.street}}</p>'
            . '<p>{{' . $path . '.city}} {{' . $path . '.province}} {{' . $path . '.zip_code}}</p>'
            . '<p>{{' . $path . '.phone}}</p>'
            . '</div>';
    }

    /**
     * Tabel baris (barang, aset, dst) dengan kolom nomor otomatis.
     *
     * @param  string  $each  path koleksi, mis. `doc.items`
     * @param  array<int, array{label: string, value: string, class?: string}>  $columns
     */
    public static function table(string $each, array $columns): string {
        $head  = '<th class="col-no">No</th>';
        $cells = '<td class="col-no">{{this.idx}}</td>';

        foreach ($columns as $column) {
            $attribute = isset($column['class']) ? ' class="' . $column['class'] . '"' : '';
            $head .= '<th' . $attribute . '>' . $column['label'] . '</th>';
            $cells .= '<td' . $attribute . '>' . $column['value'] . '</td>';
        }

        return "  <table class=\"items-table\">\n"
            . "    <thead>\n      <tr>{$head}</tr>\n    </thead>\n"
            . "    <tbody>\n      {{#each {$each}}}\n      <tr>{$cells}</tr>\n      {{/each}}\n    </tbody>\n"
            . '  </table>';
    }

    /**
     * Tabel item yang dimulai langsung dari kolom pertama (mis. Part No) dan
     * menyatukan baris ringkasan (Potongan, SubTotal, Pajak, Grand Total) di
     * bagian bawah tabel yang sama memakai `colspan`. Baris ringkasan terakhir
     * diberi latar abu-abu sebagai Grand Total.
     *
     * @param  string  $each  path koleksi, mis. `doc.items`
     * @param  array<int, array{label: string, value: string, class?: string}>  $columns
     * @param  array<int, array{0: string, 1: string, 2?: string}>  $summaryRows  [label, ekspresi, field syarat opsional]
     */
    public static function tableWithSummary(string $each, array $columns, array $summaryRows = []): string {
        $head  = '';
        $cells = '';

        foreach ($columns as $column) {
            $attribute = isset($column['class']) ? ' class="' . $column['class'] . '"' : '';
            $head .= '<th' . $attribute . '>' . $column['label'] . '</th>';
            $cells .= '<td' . $attribute . '>' . $column['value'] . '</td>';
        }

        $summaryLines = [];
        $colspan      = max(1, \count($columns) - 1);
        $lastIndex    = \count($summaryRows) - 1;

        foreach ($summaryRows as $index => $row) {
            $rowClass = $index === $lastIndex ? 'summary-row summary-grand-total' : 'summary-row';
            $line     = "<tr class=\"{$rowClass}\"><td colspan=\"{$colspan}\" class=\"summary-label\">{$row[0]}</td><td class=\"summary-value\">{$row[1]}</td></tr>";

            if (isset($row[2])) {
                $line = '{{#if ' . $row[2] . '}}' . $line . '{{/if}}';
            }

            $summaryLines[] = '      ' . $line;
        }

        $summaryBlock = $summaryLines !== [] ? "\n" . implode("\n", $summaryLines) : '';

        return "  <table class=\"items-table\">\n"
            . "    <thead>\n      <tr>{$head}</tr>\n    </thead>\n"
            . "    <tbody>\n      {{#each {$each}}}\n      <tr>{$cells}</tr>\n      {{/each}}{$summaryBlock}\n    </tbody>\n"
            . '  </table>';
    }

    /**
     * Tabel total rata kanan. Baris terakhir ditebalkan sebagai total akhir.
     *
     * @param  array<int, array{0: string, 1: string}>  $rows  [label, ekspresi]
     */
    public static function totals(array $rows): string {
        $lines = [];
        $last  = \count($rows) - 1;

        foreach ($rows as $index => $row) {
            $class   = $index === $last ? ' class="grand-total"' : '';
            $lines[] = "      <tr{$class}><td class=\"totals-label\">{$row[0]}</td><td class=\"totals-value\">{$row[1]}</td></tr>";
        }

        return "  <table class=\"totals-table\" align=\"right\">\n    <tbody>\n" . implode("\n", $lines) . "\n    </tbody>\n  </table>\n  <div class=\"clear\"></div>";
    }

    /**
     * Catatan bebas; tidak tercetak bila kosong.
     */
    public static function note(string $label, string $path): string {
        return '  {{#if ' . $path . '}}<div class="note-block"><b>' . $label . '</b><br>{{' . $path . '}}</div>{{/if}}';
    }

    /**
     * Catatan bebas satu baris ("Note : ...") di bawah tabel item.
     */
    public static function noteInline(string $label, string $path): string {
        return '  {{#if ' . $path . '}}<div class="note-inline"><b>' . $label . ' :</b> <span class="pre-line">{{' . $path . '}}</span></div>{{/if}}';
    }

    /**
     * Kotak berbingkai (untuk informasi rekening bank atau tanda terima manual).
     */
    public static function framedBox(string $innerHtml): string {
        return "  <div class=\"framed-box\">\n" . $innerHtml . "\n  </div>";
    }

    /**
     * Termin pembayaran dari `payment_schedules`; tidak tercetak bila kosong.
     */
    public static function paymentTerms(): string {
        return "  {{#if doc.payment_schedules}}\n"
            . "  <div class=\"section-title\">Termin Pembayaran</div>\n"
            . self::table('doc.payment_schedules', [
                ['label' => 'Keterangan', 'value' => '{{this.description}}'],
                ['label' => 'Porsi (%)', 'value' => '{{formatNumber this.invoice_portion 0}}', 'class' => 'col-number'],
                ['label' => 'Jatuh Tempo', 'value' => '{{formatDate this.due_date "DD-MM-YYYY"}}'],
                ['label' => 'Jumlah', 'value' => '{{formatNumber this.payment_amount 2}}', 'class' => 'col-number'],
            ]) . "\n"
            . '  {{/if}}';
    }

    /**
     * Dua slot tanda tangan berdampingan: Dibuat oleh (kiri, pembuat
     * dokumen, tanpa tanggal) dan Disetujui oleh (kanan, penandatangan
     * final approval).
     *
     * Keterangan di atas tiap slot ikut tercetak walau slot-nya kosong
     * (helper mengembalikan string kosong bila tidak ada data), jadi
     * dokumen yang belum disetujui tetap menyisakan ruang bertanda.
     */
    public static function signatures(): string {
        return "  <table class=\"approval-signatures\">\n"
            . "    <tr>\n"
            . "      <td>\n"
            . "        <div class=\"approval-signature-caption\">Dibuat oleh,</div>\n"
            . "        {{{approvalSignature role=\"creator\" showName=true}}}\n"
            . "      </td>\n"
            . "      <td>\n"
            . "        <div class=\"approval-signature-caption\">Disetujui oleh,</div>\n"
            . "        {{{approvalSignature role=\"approver\" showName=true showDate=true}}}\n"
            . "      </td>\n"
            . "    </tr>\n"
            . '  </table>';
    }

    /**
     * Blok tanda tangan campuran: dapat berisi kombinasi slot otomatis
     * (`creator` atau `approver`) dan slot tanda tangan manual (`manual`)
     * dengan jumlah kolom bebas (2 atau 3 kolom).
     *
     * @param  array<int, array{caption: string, type: 'creator'|'approver'|'manual'}>  $slots
     */
    public static function mixedSignatures(array $slots): string {
        $count = max(1, \count($slots));
        $width = round(100 / $count, 2) . '%';
        $cells = [];

        foreach ($slots as $slot) {
            $inner = match ($slot['type']) {
                'creator'  => '{{{approvalSignature role="creator" showName=true}}}',
                'approver' => '{{{approvalSignature role="approver" showName=true showDate=true}}}',
                default    => "<div class=\"manual-signature-space\"></div>\n        <div class=\"manual-signature-line\"></div>",
            };

            $cells[] = "      <td style=\"width:{$width};\">\n"
                . "        <div class=\"approval-signature-caption\">{$slot['caption']}</div>\n"
                . "        {$inner}\n"
                . '      </td>';
        }

        return "  <table class=\"approval-signatures\">\n"
            . "    <tr>\n"
            . implode("\n", $cells) . "\n"
            . "    </tr>\n"
            . '  </table>';
    }

    /**
     * Rangkai potongan menjadi satu dokumen.
     *
     * @param  array<int, string>  $parts
     */
    public static function document(array $parts): string {
        return "<body>\n" . implode("\n\n", $parts) . "\n</body>\n";
    }
}
