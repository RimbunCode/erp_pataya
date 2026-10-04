<?php

namespace App\Traits;

use App\Models\Core\Branch;
use App\Services\Core\BranchScopeCache;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

/**
 * @mixin Model
 */
trait HasBranch {
    protected static string $branchColumn = 'branch_id';

    public static function bootHasBranch() {
        static::addGlobalScope('branch', function (Builder $builder) {
            $user = Auth::user();
            if ($user) {
                // BranchScopeCache (statis per proses, bukan static property
                // trait ini) -- scope jalan ULANG di SETIAP query model
                // ber-HasBranch (route-model-binding halaman Show, tiap
                // relasi ber-HasBranch yang di-eager-load, tiap partial
                // reload Inertia::defer dari DataTable::showDetail()). Tanpa
                // cache, `user->branches()->exists()` ikut terulang puluhan
                // kali per request Show (ditemukan user via Clockwork).
                $isMainBranchUser = BranchScopeCache::userIsMainBranch(
                    $user->getKey(),
                    fn () => $user->branches()->where('is_main_branch', true)->exists(),
                );
                if ($isMainBranchUser) {
                    return;
                }
            }

            if (! session()->has('currentBranch')) {
                return;
            }

            $sessionBranchId = session('currentBranch');
            $branchId        = BranchScopeCache::branchId($sessionBranchId, function () use ($sessionBranchId) {
                // select+withoutGlobalScope('country'): global scope ini cuma
                // butuh id, tapi Branch::find() biasa memicu 2 query Country
                // tambahan (billingCountry+shippingCountry via $with Branch)
                // SETIAP query model ber-HasBranch (Asset listing eager-load
                // assetLocation nested berkali-kali) — N+1 nyata.
                return Branch::query()
                    ->withoutGlobalScope('country')
                    ->select(['id'])
                    ->find($sessionBranchId)?->id;
            });
            if (! $branchId) {
                return;
            }

            $column = $builder->getModel()->getTable() . '.' . static::getBranchColumn();
            $builder->where($column, $branchId);
        });
    }

    public static function getBranchColumn(): string {
        return static::$branchColumn;
    }

    public function scopeWithoutBranch(Builder $query): Builder {
        return $query->withoutGlobalScope('branch');
    }
}
