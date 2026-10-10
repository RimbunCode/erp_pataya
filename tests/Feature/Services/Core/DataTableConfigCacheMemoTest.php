<?php

namespace Tests\Feature\Services\Core;

use App\Models\Core\Branch;
use App\Models\User\User;
use App\Services\Core\DataTableConfigCache;
use Illuminate\Cache\Events\CacheHit;
use Illuminate\Cache\Events\CacheMissed;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class DataTableConfigCacheMemoTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        config(['datatable.config_cache_enabled' => true]);
    }

    /** @return callable(): int jumlah akses cache (hit + miss) sejak dibuat */
    private function cacheReadCounter(): callable {
        $reads = 0;
        Event::listen([CacheHit::class, CacheMissed::class], function () use (&$reads): void {
            $reads++;
        });

        return function () use (&$reads): int {
            return $reads;
        };
    }

    /**
     * Satu request bisa meminta konfigurasi kolom model yang sama berkali-kali
     * (mis. relasi Branch/User dari beberapa kolom). Tiap panggilan sebelumnya
     * membaca store cache lagi (satu SELECT ke tabel `cache` pada driver database).
     */
    public function test_flat_reads_cache_store_only_once_per_model_within_a_request(): void {
        $reads = $this->cacheReadCounter();

        $first           = DataTableConfigCache::flat(Branch::class);
        $readsAfterFirst = $reads();
        $this->assertGreaterThan(0, $readsAfterFirst, 'panggilan pertama harus membaca cache');

        $second = DataTableConfigCache::flat(Branch::class);
        $third  = DataTableConfigCache::flat(Branch::class);

        $this->assertSame($readsAfterFirst, $reads(), 'panggilan berikutnya tak boleh membaca cache lagi');
        $this->assertSame($first, $second);
        $this->assertSame($first, $third);
    }

    public function test_memo_is_per_model(): void {
        $reads = $this->cacheReadCounter();

        DataTableConfigCache::flat(Branch::class);
        $afterBranch = $reads();

        DataTableConfigCache::flat(User::class);

        $this->assertGreaterThan($afterBranch, $reads(), 'model lain tetap harus membaca cache sendiri');
    }

    public function test_forget_clears_the_memo_so_next_call_reads_the_store_again(): void {
        DataTableConfigCache::flat(Branch::class);
        $reads = $this->cacheReadCounter();

        DataTableConfigCache::forget(Branch::class);
        DataTableConfigCache::flat(Branch::class);

        $this->assertGreaterThan(0, $reads(), 'setelah forget() konfigurasi harus dibaca ulang');
    }

    public function test_warm_refreshes_the_memo_with_the_new_value(): void {
        DataTableConfigCache::flat(Branch::class);

        $warmed = DataTableConfigCache::warm(Branch::class);

        $this->assertSame($warmed, DataTableConfigCache::flat(Branch::class));
    }
}
