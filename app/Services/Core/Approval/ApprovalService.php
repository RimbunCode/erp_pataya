<?php

namespace App\Services\Core\Approval;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Models\Core\ApprovalInstance;
use App\Models\Model;

class ApprovalService {
    /**
     * Evaluasi approval untuk dokumen submitable. Jika tidak ada ApprovalScheme
     * aktif atau langsung fully-approved, panggil onApproved(). Jika rejected,
     * panggil onRejected(). Jika masih pending, update status ke NEED_APPROVAL.
     *
     * @param  string  $serviceClass  FQCN Service yang implement SubmitableService
     * @param  array  $options  Opsi tambahan yang diteruskan ke makeInstance
     *                          (controller/parameters lama TIDAK lagi diset)
     */
    public function check(Model $document, string $serviceClass, array $options = [], string $triggerOn = 'submit'): mixed {
        /** @var SubmitableService $service */
        $service = app($serviceClass);

        $instance = ApprovalInstance::makeInstance($document, [
            'options' => $options,
        ], $triggerOn);

        if (! $instance || $instance->status === FormStatus::APPROVED) {
            return $service->onApproved($document);
        }

        if ($instance->status === FormStatus::REJECTED) {
            return $service->onRejected($document);
        }

        $document->update([
            'status' => FormStatus::NEED_APPROVAL,
        ]);

        return null;
    }
}
