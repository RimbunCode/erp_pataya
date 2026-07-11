<?php

return [
    'wkhtmltopdf_binary' => env('WKHTMLTOPDF_BINARY_PATH', storage_path('app/bin/wkhtmltopdf')),

    'wkhtmltopdf_timeout' => (int) env('WKHTMLTOPDF_TIMEOUT_SECONDS', 30),
];
