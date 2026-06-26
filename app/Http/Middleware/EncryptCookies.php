<?php

namespace App\Http\Middleware;

use Illuminate\Cookie\Middleware\EncryptCookies as Middleware;

class EncryptCookies extends Middleware {
    /**
     * Cookie yang dikecualikan dari enkripsi. Mendukung wildcard fnmatch-style:
     *   *  → nol atau lebih karakter apa pun
     *   ?  → tepat satu karakter
     */
    protected array $exceptPatterns = [
        'theme',
        'datatable_show',
        'datatable_columns*',
    ];

    public function isDisabled($name) {
        foreach ($this->exceptPatterns as $pattern) {
            if (\fnmatch($pattern, $name)) {
                return true;
            }
        }

        return parent::isDisabled($name);
    }
}
