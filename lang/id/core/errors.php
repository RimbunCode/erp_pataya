<?php

return [
    'http' => [
        'default' => 'Terjadi kesalahan saat memproses permintaan Anda.',
        400       => 'Permintaan tidak valid. Silakan periksa data yang dikirim.',
        401       => 'Sesi Anda berakhir atau belum login. Silakan login kembali.',
        403       => 'Anda tidak memiliki izin untuk melakukan aksi ini.',
        404       => 'Data atau halaman yang diminta tidak ditemukan.',
        405       => 'Metode request tidak diizinkan untuk endpoint ini.',
        409       => 'Terjadi konflik data. Silakan muat ulang halaman dan coba lagi.',
        419       => 'Halaman kedaluwarsa. Silakan refresh lalu coba lagi.',
        422       => 'Data tidak valid. Silakan periksa kembali input Anda.',
        429       => 'Terlalu banyak permintaan. Coba lagi beberapa saat lagi.',
        500       => 'Terjadi kesalahan server internal.',
        502       => 'Server upstream sedang bermasalah.',
        503       => 'Layanan sementara tidak tersedia.',
        504       => 'Waktu tunggu ke server habis.',
    ],
    'network' => [
        'title'       => 'Koneksi gagal',
        'description' => 'Tidak dapat menghubungi server. Periksa koneksi Anda.',
    ],
    'fetch_failed' => 'Gagal memuat data. Silakan coba lagi.',
];
