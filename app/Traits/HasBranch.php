<?php

namespace App\Traits;

use App\Models\Core\Branch;
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
            if ($user && $user->branches()->where('is_main_branch', true)->exists()) {
                return;
            }

            if (! session()->has('currentBranch')) {
                return;
            }

            // select+withoutGlobalScope('country'): global scope ini cuma
            // butuh id, tapi Branch::find() biasa memicu 2 query Country
            // tambahan (billingCountry+shippingCountry via $with Branch)
            // SETIAP query model ber-HasBranch (Asset listing eager-load
            // assetLocation nested berkali-kali) — N+1 nyata.
            $branch = Branch::query()
                ->withoutGlobalScope('country')
                ->select(['id'])
                ->find(session('currentBranch'));
            if (! $branch) {
                return;
            }

            $column = $builder->getModel()->getTable() . '.' . static::getBranchColumn();
            $builder->where($column, $branch->id);
        });
    }

    public static function getBranchColumn(): string {
        return static::$branchColumn;
    }

    public function scopeWithoutBranch(Builder $query): Builder {
        return $query->withoutGlobalScope('branch');
    }
}
