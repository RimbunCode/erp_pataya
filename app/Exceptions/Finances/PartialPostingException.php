<?php

namespace App\Exceptions\Finances;

use RuntimeException;

/**
 * Sebagian jurnal sebuah konteks posting sudah ada dan sebagian belum (Finance Fase 2, Requirement 5.4): kondisi
 * inkonsisten yang dilaporkan, bukan ditulis diam-diam; butuh intervensi.
 */
class PartialPostingException extends RuntimeException {
    /**
     * @param  list<string>  $existingKeys  `postingKey` yang sudah ada
     * @param  list<string>  $missingKeys  `postingKey` yang belum ada
     */
    public function __construct(
        string $message,
        public readonly array $existingKeys = [],
        public readonly array $missingKeys = [],
    ) {
        parent::__construct($message);
    }

    /**
     * @param  list<string>  $existingKeys
     * @param  list<string>  $missingKeys
     */
    public static function for(string $sourceType, string $sourceId, array $existingKeys, array $missingKeys): self {
        return new self(
            __('finances/posting.errors.partial_posting', [
                'source'   => "{$sourceType}:{$sourceId}",
                'existing' => implode(', ', $existingKeys),
                'missing'  => implode(', ', $missingKeys),
            ]),
            $existingKeys,
            $missingKeys,
        );
    }
}
