<?php

namespace App\Http\Requests\User;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;

class SignatureUploadRequest extends BaseFormRequest {
    /**
     * Ukuran berkas maksimum dalam kilobyte (FR2: 5 MB).
     */
    private const MAX_FILE_KILOBYTES = 5120;

    /**
     * Otorisasi ditangani `UserController::exceptPermission()`, yang mengunci
     * mutasi TTD ke pemilik akun. Lihat catatan di sana: aturannya sengaja
     * lebih ketat daripada foto profil.
     */
    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            // `image` memeriksa ISI berkas lewat getimagesize(), bukan
            // ekstensi nama berkas maupun Content-Type dari klien (FR2).
            // `mimetypes` membatasi lebih lanjut ke daftar yang didukung GD.
            'signature' => [
                'required',
                'file',
                'image',
                'mimetypes:image/jpeg,image/png,image/webp,image/gif,image/bmp,image/x-ms-bmp',
                'max:' . self::MAX_FILE_KILOBYTES,
            ],
            // Menentukan apakah pipeline threshold dijalankan. Hasil canvas
            // sudah transparan sejak lahir, jadi melewatinya (FR3); menerapkan
            // threshold pada gambar beralpha justru merusaknya.
            'source' => ['required', 'string', 'in:upload,canvas'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array {
        return [
            'signature.mimetypes' => __('user.signature.errors.unsupported_format'),
            'signature.image'     => __('user.signature.errors.unreadable_image'),
        ];
    }
}
