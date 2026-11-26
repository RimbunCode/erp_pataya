<?php

namespace App\Services\Finances\Posting\AccountPanel;

use RuntimeException;

/**
 * Pratinjau akun tidak dapat dibangun karena sebab yang dapat diduga dan bukan galat sistem (konfigurasi pendukung
 * belum lengkap, atau jenis dokumen yang memang ditolak engine). Dilempar `PanelSource`; `PostedAccountPanel` mengubahnya
 * menjadi state `error` berpesan jelas tanpa `report()`, agar log tidak terisi galat yang sama pada setiap muat halaman.
 * Pesan sudah berlokalisasi dari pelempar.
 */
final class PanelPreviewUnavailableException extends RuntimeException {}
