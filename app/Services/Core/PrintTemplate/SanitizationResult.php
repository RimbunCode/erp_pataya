<?php

namespace App\Services\Core\PrintTemplate;

/**
 * Result object for HTML sanitization operations
 *
 * Contains the sanitized HTML content along with information about
 * what was removed during the sanitization process.
 */
class SanitizationResult {
    /**
     * Create a new sanitization result instance
     *
     * @param  string  $sanitizedHTML  The cleaned HTML content
     * @param  array  $warnings  Human-readable warning messages
     * @param  array  $removedTags  List of tag names that were removed
     * @param  array  $removedAttributes  List of attribute names that were removed
     */
    public function __construct(
        public string $sanitizedHTML,
        public array $warnings = [],
        public array $removedTags = [],
        public array $removedAttributes = [],
    ) {}

    /**
     * Check if any content was removed during sanitization
     *
     * @return bool True if tags or attributes were removed
     */
    public function hasRemovals(): bool {
        return ! empty($this->removedTags) || ! empty($this->removedAttributes);
    }

    /**
     * Get a summary of what was removed
     *
     * @return string Human-readable summary
     */
    public function getSummary(): string {
        if (! $this->hasRemovals()) {
            return 'No dangerous content found.';
        }

        $parts = [];

        if (! empty($this->removedTags)) {
            $parts[] = \count($this->removedTags) . ' dangerous tag(s)';
        }

        if (! empty($this->removedAttributes)) {
            $parts[] = \count($this->removedAttributes) . ' dangerous attribute(s)';
        }

        return 'Removed: ' . \implode(' and ', $parts);
    }

    /**
     * Convert the result to an array
     *
     * @return array Array representation of the result
     */
    public function toArray(): array {
        return [
            'sanitizedHTML'     => $this->sanitizedHTML,
            'warnings'          => $this->warnings,
            'removedTags'       => $this->removedTags,
            'removedAttributes' => $this->removedAttributes,
            'hasRemovals'       => $this->hasRemovals(),
            'summary'           => $this->getSummary(),
        ];
    }
}
