<?php

namespace App\Services\Finances\Tax;

use App\Models\Finances\Tax;
use Illuminate\Validation\ValidationException;

/**
 * Aturan kombinasi pajak majemuk pada satu item dokumen (spek finance-multi-tax-per-item, Requirement 2) dan
 * normalisasi kontrak baris (`tax` tunggal menjadi `taxes`, Requirement 8.2). Kelas pure: tidak mengenal model
 * dokumen, hanya daftar `Tax` terurut. Dipanggil FormRequest (pesan ke pengguna) DAN service (jaring pengaman bagi
 * jalur non-HTTP).
 *
 * Aturan: tolak `tax_id` duplikat; tolak lebih dari satu `ppn_standard` (Q-MT-3); tolak lebih dari `MAX_TAXES` pajak
 * (Q-MT-4); pajak penambah bersama pajak potong boleh (mis. PPN + PPh 23); `unclassified` boleh (tertanam, P-6).
 * Daftar kosong bukan pelanggaran di sini: wajib-tidaknya pajak per baris diputuskan `ValidatesRowTaxRequired`.
 */
final class ItemTaxSelection {
    /** Batas jumlah pajak per item (Q-MT-4). */
    public const MAX_TAXES = 5;

    public const VIOLATION_DUPLICATE    = 'duplicate';
    public const VIOLATION_MULTIPLE_PPN = 'multiple_ppn';
    public const VIOLATION_TOO_MANY     = 'too_many';

    /** Hanya untuk pesan (bukan keluaran `violations()`): baris wajib punya minimal satu pajak. */
    public const VIOLATION_REQUIRED = 'required';

    /**
     * Kode pelanggaran (kosong = valid) untuk daftar pajak terurut sebuah item. Daftar boleh memuat model yang sama
     * lebih dari sekali (itulah duplikat).
     *
     * @param  iterable<Tax>  $taxes
     * @return list<string>
     */
    public static function violations(iterable $taxes): array {
        $ids         = [];
        $standardPpn = 0;
        $count       = 0;
        $violations  = [];

        foreach ($taxes as $tax) {
            $count++;
            $id = (string) $tax->getKey();
            if (isset($ids[$id])) {
                $violations[self::VIOLATION_DUPLICATE] = self::VIOLATION_DUPLICATE;
            }
            $ids[$id] = true;

            if ($tax->category === Tax::CATEGORY_PPN_STANDARD) {
                $standardPpn++;
            }
        }

        if ($standardPpn > 1) {
            $violations[self::VIOLATION_MULTIPLE_PPN] = self::VIOLATION_MULTIPLE_PPN;
        }
        if ($count > self::MAX_TAXES) {
            $violations[self::VIOLATION_TOO_MANY] = self::VIOLATION_TOO_MANY;
        }

        return array_values($violations);
    }

    /**
     * Pesan pengguna (id/en) untuk sebuah kode pelanggaran.
     */
    public static function message(string $violation): string {
        return __("finances/taxes.selection.{$violation}", ['max' => self::MAX_TAXES]);
    }

    /**
     * Pajak baris request dalam bentuk ternormalisasi: `taxes` (array objek `{id, ...}`) menang; bila kosong,
     * `tax` tunggal dibungkus menjadi satu elemen (Q-MT-8). Objek tanpa `id` terisi dibuang.
     *
     * @param  array<string, mixed>  $row
     * @return list<array<string, mixed>>
     */
    public static function rowTaxes(array $row): array {
        $taxes = $row['taxes'] ?? null;
        if (\is_array($taxes) && $taxes !== []) {
            return array_values(array_filter($taxes, static fn (mixed $tax): bool => \is_array($tax) && filled($tax['id'] ?? null)));
        }

        $single = $row['tax'] ?? null;

        return \is_array($single) && filled($single['id'] ?? null) ? [$single] : [];
    }

    /**
     * @param  array<string, mixed>  $row
     * @return list<string> id pajak baris menurut urutan (Pajak Utama lebih dulu), dengan duplikat apa adanya
     */
    public static function rowTaxIds(array $row): array {
        return array_map(static fn (array $tax): string => (string) $tax['id'], self::rowTaxes($row));
    }

    /**
     * Kunci galat per baris: `items.{index}.taxes`. Pesan pelanggaran pertama dipakai per kode.
     *
     * @param  iterable<int|string, array<string, mixed>>  $rows  baris request
     * @param  array<string, Tax>  $taxes  pajak termuat per id (id yang tak termuat dilewati)
     * @return array<string, list<string>> pesan per kunci galat
     */
    public static function errorsForRows(iterable $rows, array $taxes): array {
        $errors = [];
        foreach ($rows as $index => $row) {
            $selected = [];
            foreach (self::rowTaxIds((array) $row) as $id) {
                if (isset($taxes[$id])) {
                    $selected[] = $taxes[$id];
                }
            }

            $violations = self::violations($selected);
            if ($violations !== []) {
                $errors["items.{$index}.taxes"] = array_map(self::message(...), $violations);
            }
        }

        return $errors;
    }

    /**
     * Jaring pengaman service: sama dengan `errorsForRows()` tetapi melempar `ValidationException`.
     *
     * @param  iterable<int|string, array<string, mixed>>  $rows
     * @param  array<string, Tax>  $taxes
     *
     * @throws ValidationException
     */
    public static function assertRows(iterable $rows, array $taxes): void {
        $errors = self::errorsForRows($rows, $taxes);
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }
}
