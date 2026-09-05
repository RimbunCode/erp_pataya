<?php

namespace Tests\Feature\Core;

use App\Services\Core\CustomChartSource\CustomChartSourceRegistry;
use Tests\TestCase;

/**
 * Requirement 7.1/7.3: registry TERTUTUP — hanya key terdaftar eksplisit
 * di kode yang boleh dieksekusi, string bebas dari input user ditolak.
 */
class CustomChartSourceRegistryTest extends TestCase {
    public function test_unregistered_key_is_rejected(): void {
        $registry = new CustomChartSourceRegistry;

        $this->expectException(\RuntimeException::class);
        $registry->resolve('tidak_terdaftar', []);
    }

    public function test_null_key_is_rejected(): void {
        $registry = new CustomChartSourceRegistry;

        $this->expectException(\RuntimeException::class);
        $registry->resolve(null, []);
    }

    public function test_is_registered_false_for_unknown_key(): void {
        $registry = new CustomChartSourceRegistry;

        $this->assertFalse($registry->isRegistered('apapun'));
    }
}
