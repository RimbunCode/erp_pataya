<?php

namespace App\Exceptions\User;

/**
 * Kesalahan pemrosesan gambar TTD di `SignatureImageService`. Tiap kasus
 * punya named constructor sendiri dengan kunci terjemahan sendiri (lihat
 * lang/{en,id}/user/signature.php), supaya pesan yang sampai ke user
 * spesifik menyebut apa yang harus diperbaiki, bukan "gagal memproses
 * gambar" yang generik.
 */
class SignatureProcessingException extends \RuntimeException {
    public function __construct(
        string $message,
        public readonly string $translationKey,
    ) {
        parent::__construct($message);
    }

    public static function unreadableImage(): self {
        $key = 'user.signature.errors.unreadable_image';

        return new self(__($key), $key);
    }

    public static function unsupportedFormat(): self {
        $key = 'user.signature.errors.unsupported_format';

        return new self(__($key), $key);
    }

    public static function noSignatureDetected(): self {
        $key = 'user.signature.errors.no_signature_detected';

        return new self(__($key), $key);
    }

    public static function imageTooDark(): self {
        $key = 'user.signature.errors.image_too_dark';

        return new self(__($key), $key);
    }
}
