<?php

namespace App\Services\Core\Approval;

use App\Models\Core\ApprovalInstance;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Kelayakan akses terhadap approval instance, dipakai bersama oleh
 * `ApprovalInstanceController` (boleh membuka dokumen) dan
 * `UserController::showSignature()` (boleh melihat tanda tangan approver).
 *
 * Dipisah ke service justru supaya kedua pemakai itu tidak punya salinan
 * aturan masing-masing: aturan siapa-boleh-melihat-approval-apa cukup rumit
 * (single vs advanced approver, user vs role, plus riwayat acted_by) sehingga
 * dua salinan pasti akan menyimpang.
 */
class ApprovalAccessService {
    /**
     * Apakah user terlibat pada approval instance ini, baik sebagai kandidat
     * approver (langsung maupun lewat role) atau sebagai orang yang pernah
     * bertindak di salah satu step-nya.
     */
    public function canAccessInstance(?User $user, ApprovalInstance $approvalInstance): bool {
        if (! $user) {
            return false;
        }

        $roleIds = $user->roles->pluck('id');

        return $approvalInstance->steps()
            ->where(function (Builder $query) use ($user, $roleIds) {
                $this->applyInvolvementFilter($query, $user, $roleIds);
            })
            ->exists();
    }

    /**
     * Apakah `$viewer` boleh melihat tanda tangan milik `$owner` (FR7).
     *
     * Dua jalan: pemilik akun itu sendiri, atau kedua orang sama-sama
     * terlibat pada setidaknya satu approval instance -- `$owner` sebagai
     * penandatangan (`acted_by_id`), `$viewer` sebagai pihak yang berhak
     * membuka instance itu.
     */
    public function canViewSignatureOf(?User $viewer, User $owner): bool {
        if (! $viewer) {
            return false;
        }

        if ($viewer->id === $owner->id) {
            return true;
        }

        $roleIds = $viewer->roles->pluck('id');

        return ApprovalInstance::query()
            // Instance yang memuat tanda tangan $owner.
            ->whereHas('steps', function (Builder $query) use ($owner) {
                $query->where('acted_by_id', $owner->id);
            })
            // ... DAN yang boleh dibuka oleh $viewer. Dua whereHas terpisah,
            // bukan satu: keduanya boleh dipenuhi oleh STEP YANG BERBEDA di
            // instance yang sama, yang justru kasus lazimnya (approver step 1
            // melihat tanda tangan approver step 2).
            ->whereHas('steps', function (Builder $query) use ($viewer, $roleIds) {
                $this->applyInvolvementFilter($query, $viewer, $roleIds);
            })
            ->exists();
    }

    /**
     * Filter step yang melibatkan user: sebagai approver tunggal (kolom di
     * step), sebagai approver anak pada step advanced, atau sebagai pelaku
     * keputusan yang tercatat.
     *
     * @param  \Illuminate\Support\Collection<int, string>  $roleIds
     */
    private function applyInvolvementFilter(Builder $query, User $user, $roleIds): void {
        $query->where(function (Builder $query) use ($user, $roleIds) {
            // single-approver
            $query->where(function (Builder $query) use ($user, $roleIds) {
                $query->where('is_advanced', false)
                    ->where(function (Builder $query) use ($user, $roleIds) {
                        $query->where(function (Builder $query) use ($roleIds) {
                            $query->where('approver_type', 'role')
                                ->whereIn('approverable_id', $roleIds);
                        })->orWhere(function (Builder $query) use ($user) {
                            $query->where('approver_type', 'user')
                                ->where('approverable_id', $user->id);
                        });
                    });
            })
                // multi-approver: ada sebagai approver anak
                ->orWhere(function (Builder $query) use ($user, $roleIds) {
                    $query->where('is_advanced', true)
                        ->whereHas('approvers', function (Builder $q) use ($user, $roleIds) {
                            $q->where(function ($q) use ($user) {
                                $q->where('approver_type', 'user')->where('approverable_id', $user->id);
                            })->orWhere(function ($q) use ($roleIds) {
                                $q->where('approver_type', 'role')->whereIn('approverable_id', $roleIds);
                            });
                        });
                })
                ->orWhere('acted_by_id', $user->id);
        });
    }
}
