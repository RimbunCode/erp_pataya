<?php
$dir             = __DIR__ . '/lang/en';
$files           = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
$allTranslations = [];
foreach ($files as $file) {
    if ($file->isFile() && $file->getExtension() === 'php') {
        $path         = str_replace('\\', '/', $file->getPathname());
        $dirPath      = str_replace('\\', '/', $dir);
        $relativePath = str_replace($dirPath . '/', '', $path);

        // Skip user_v2.php if it exists
        if (str_contains($relativePath, 'v2')) {
            continue;
        }

        $allTranslations[$relativePath] = require $path;
    }
}
file_put_contents('en_translations.json', json_encode($allTranslations));
echo 'Created en_translations.json';
