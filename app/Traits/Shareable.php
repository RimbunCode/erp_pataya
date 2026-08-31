<?php

namespace App\Traits;

use App\Models\User\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Visibility tambahan (di luar permission model target) buat entity yang
 * bisa di-share ke User/Role tertentu — pola sama persis `Desk` +
 * `DeskAssignable` (lihat `DeskResolverService::firstVisible()`), TAPI
 * sengaja BUKAN owner-restrictive: `created_by_id` di sini murni atribusi,
 * tidak ikut jadi gate visibility. Gate dasar (permission Select/Read ke
 * model target) dicek terpisah di layer PHP (`PermissionChecker`), bukan
 * lewat trait ini — scope di sini HANYA mewakili jalur TAMBAHAN yang
 * melebarkan visibility (`is_shared_all` / assign eksplisit), digabung
 * lewat OR dengan hasil PermissionChecker oleh pemanggil.
 */
trait Shareable {
    abstract protected function assignablePivot(): string;

    public function assignables(): HasMany {
        return $this->hasMany($this->assignablePivot());
    }

    public function scopeVisibleByShare(Builder $query, User $user, array $roleIds): Builder {
        return $query->where('is_shared_all', true)
            ->orWhereHas('assignables', function (Builder $q) use ($roleIds, $user) {
                $q->where(fn (Builder $qq) => $qq->where('assignable_type', 'role')->whereIn('assignable_id', $roleIds))
                    ->orWhere(fn (Builder $qq) => $qq->where('assignable_type', 'user')->where('assignable_id', $user->id));
            });
    }

    /**
     * Versi instance dari `scopeVisibleByShare()` — dipakai controller utk
     * re-cek gate share pada SATU record yang sudah ter-resolve lewat route
     * model binding (mis. endpoint getValue/getData), di mana query scope
     * tidak berlaku lagi (Requirement 8.4).
     */
    public function isSharedWith(User $user, array $roleIds): bool {
        if ($this->is_shared_all) {
            return true;
        }

        return $this->assignables->contains(
            fn ($a) => ($a->assignable_type === 'user' && $a->assignable_id === $user->id)
                || ($a->assignable_type === 'role' && in_array($a->assignable_id, $roleIds, true)),
        );
    }
}
