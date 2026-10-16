<?php

namespace App\Http\Requests\CRM;

use App\Services\Core\PrintTemplate\HTMLSanitizerService;

/**
 * Pembersihan HTML isi blok teks Quotation, dipakai bersama oleh
 * QuotationRequest (blok di dalam dokumen) dan QuotationSectionTemplateRequest
 * (blok yang disimpan sebagai template).
 *
 * Keduanya WAJIB memakai allowlist yang sama. Isi blok dicetak lewat
 * `{{{this.content}}}` tanpa escape lalu masuk `innerHTML` iframe pratinjau
 * cetak, jadi HTML yang lolos ke basis data langsung berjalan di peramban
 * siapa pun yang membuka pratinjau itu. Dua salinan allowlist yang menyimpang
 * berarti satu jalur masuk tertinggal terbuka.
 */
class QuotationSectionContent {
    /**
     * Tag yang dihasilkan TipTap pada blok teks Quotation.
     *
     * "p" wajib ada: TipTap selalu membungkus teks dalam paragraph node, dan
     * HTMLSanitizerService membuang seluruh elemen root beserta isinya bila
     * tag root tidak masuk allowlist. Mengikuti temuan yang sama pada label
     * section desk-dashboard-builder (lihat DeskController::storeDashboard).
     *
     * @var list<string>
     */
    public const ALLOWED_TAGS = ['p', 'ol', 'ul', 'li', 'strong', 'em', 'u', 's', 'br'];

    /**
     * Sanitizer sekali pakai untuk satu permintaan; dibuat di luar perulangan
     * supaya blok yang banyak tidak membangun ulang allowlist berkali-kali.
     */
    public static function sanitizer(): HTMLSanitizerService {
        return new HTMLSanitizerService(allowedTagsOverride: self::ALLOWED_TAGS);
    }

    /**
     * Bersihkan satu isi blok. Mengembalikan string kosong bila setelah
     * dibersihkan tidak ada teks tersisa, supaya aturan `required` tetap
     * menolak editor yang hanya berisi tag kosong seperti `<p></p>`.
     */
    public static function clean(string $content, ?HTMLSanitizerService $sanitizer = null): string {
        if (trim(strip_tags($content)) === '') {
            return '';
        }

        $sanitized = ($sanitizer ?? self::sanitizer())->sanitize($content)->sanitizedHTML;

        return trim(strip_tags($sanitized)) === '' ? '' : $sanitized;
    }
}
