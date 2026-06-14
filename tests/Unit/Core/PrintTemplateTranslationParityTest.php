<?php

namespace Tests\Unit\Core;

use PHPUnit\Framework\TestCase;

/**
 * Validates: Requirements 15.4
 *
 * Property 1: Translation key parity across locales
 * For any translation key defined in lang/en/core/printTemplate.php,
 * the same key SHALL exist in lang/id/core/printTemplate.php and vice versa.
 */
class PrintTemplateTranslationParityTest extends TestCase {
    private string $enFilePath;
    private string $idFilePath;

    protected function setUp(): void {
        parent::setUp();

        $this->enFilePath = dirname(__DIR__, 2) . '/../lang/en/core/printTemplate.php';
        $this->idFilePath = dirname(__DIR__, 2) . '/../lang/id/core/printTemplate.php';
    }

    /**
     * Recursively extract all keys from a nested array using dot notation.
     *
     * @return array<int, string>
     */
    private function extractKeys(array $array, string $prefix = ''): array {
        $keys = [];

        foreach ($array as $key => $value) {
            $fullKey = $prefix === '' ? (string) $key : $prefix . '.' . $key;

            if (is_array($value)) {
                $keys = array_merge($keys, $this->extractKeys($value, $fullKey));
            } else {
                $keys[] = $fullKey;
            }
        }

        sort($keys);

        return $keys;
    }

    public function test_translation_files_exist(): void {
        $this->assertFileExists($this->enFilePath, 'English translation file does not exist.');
        $this->assertFileExists($this->idFilePath, 'Indonesian translation file does not exist.');
    }

    public function test_translation_files_return_arrays(): void {
        $enTranslations = require $this->enFilePath;
        $idTranslations = require $this->idFilePath;

        $this->assertIsArray($enTranslations, 'English translation file must return an array.');
        $this->assertIsArray($idTranslations, 'Indonesian translation file must return an array.');
    }

    /**
     * **Validates: Requirements 15.4**
     *
     * Asserts that both locale files have identical key structures.
     * Every key in English must exist in Indonesian and vice versa.
     */
    public function test_translation_key_parity_across_locales(): void {
        $enTranslations = require $this->enFilePath;
        $idTranslations = require $this->idFilePath;

        $enKeys = $this->extractKeys($enTranslations);
        $idKeys = $this->extractKeys($idTranslations);

        $missingInId = array_diff($enKeys, $idKeys);
        $missingInEn = array_diff($idKeys, $enKeys);

        $this->assertEmpty(
            $missingInId,
            'Keys present in English but missing in Indonesian: ' . implode(', ', $missingInId),
        );

        $this->assertEmpty(
            $missingInEn,
            'Keys present in Indonesian but missing in English: ' . implode(', ', $missingInEn),
        );

        $this->assertEquals(
            $enKeys,
            $idKeys,
            'Translation key structures must be identical across both locales.',
        );
    }

    /**
     * Asserts that the editor array specifically has key parity,
     * since all new i18n keys are added under the editor namespace.
     */
    public function test_editor_keys_have_parity(): void {
        $enTranslations = require $this->enFilePath;
        $idTranslations = require $this->idFilePath;

        $this->assertArrayHasKey('editor', $enTranslations, 'English file must have an editor array.');
        $this->assertArrayHasKey('editor', $idTranslations, 'Indonesian file must have an editor array.');

        $enEditorKeys = $this->extractKeys($enTranslations['editor']);
        $idEditorKeys = $this->extractKeys($idTranslations['editor']);

        $missingInId = array_diff($enEditorKeys, $idEditorKeys);
        $missingInEn = array_diff($idEditorKeys, $enEditorKeys);

        $this->assertEmpty(
            $missingInId,
            'Editor keys present in English but missing in Indonesian: ' . implode(', ', $missingInId),
        );

        $this->assertEmpty(
            $missingInEn,
            'Editor keys present in Indonesian but missing in English: ' . implode(', ', $missingInEn),
        );
    }
}
