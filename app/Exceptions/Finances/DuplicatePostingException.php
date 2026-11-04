<?php

namespace App\Exceptions\Finances;

use RuntimeException;

/**
 * `postingKey` sudah dipakai jurnal lain (Requirement 3.2). Membawa `journal_id` yang sudah ada agar pemanggil
 * (listener posting) dapat memperlakukannya sebagai sudah terposting.
 */
class DuplicatePostingException extends RuntimeException {
    public function __construct(
        public readonly string $journalId,
        public readonly string $postingKey,
    ) {
        parent::__construct(__('finances/journal.errors.duplicate_posting', ['key' => $postingKey]));
    }
}
