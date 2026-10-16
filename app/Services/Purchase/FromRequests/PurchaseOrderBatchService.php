<?php

namespace App\Services\Purchase\FromRequests;

use App\Http\Requests\Purchase\PurchaseOrderBatchRequest;
use App\Models\Core\Branch;
use App\Models\Purchase\PurchaseOrderBatchSubmission;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Purchase\PurchaseRequestItem;
use App\Models\User\User;
use App\Services\Purchase\PurchaseOrderService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PurchaseOrderBatchService {
    public function __construct(
        private PurchaseRequestPoSourceResolver $sources,
        private PurchaseOrderService $purchaseOrders,
    ) {}

    /** @param array{token: string, idempotency_key: string, drafts: array<int, array<string, mixed>>} $data */
    public function createDrafts(array $data, User $user, ?string $branchId): PurchaseOrderBatchSubmission {
        $payloadHash = hash('sha256', json_encode($this->canonicalize($data['drafts']), JSON_THROW_ON_ERROR));
        $submission  = DB::transaction(function () use ($data, $user, $branchId, $payloadHash): PurchaseOrderBatchSubmission {
            $created = DB::table('purchase_order_batch_submissions')->insertOrIgnore([
                'id'                 => (string) Str::ulid(),
                'user_id'            => $user->id,
                'branch_id'          => $branchId,
                'token'              => $data['token'],
                'idempotency_key'    => $data['idempotency_key'],
                'payload_hash'       => $payloadHash,
                'purchase_order_ids' => json_encode([], JSON_THROW_ON_ERROR),
                'created_at'         => now(),
                'updated_at'         => now(),
            ]);
            $submission = PurchaseOrderBatchSubmission::query()
                ->where('user_id', $user->id)
                ->where('idempotency_key', $data['idempotency_key'])
                ->lockForUpdate()
                ->firstOrFail();

            if (! $created) {
                if ($submission->branch_id !== $branchId || $submission->token !== $data['token'] || ! hash_equals($submission->payload_hash, $payloadHash)) {
                    throw ValidationException::withMessages(['idempotency_key' => __('The idempotency key was already used for a different request.')]);
                }

                return $submission;
            }

            $context = $this->sources->tokenContext($data['token'], $user, $branchId);
            $ids     = $context['ids'];
            PurchaseRequest::query()->where('branch_id', $branchId)->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get();
            $lockedItems = PurchaseRequestItem::query()->whereIn('purchase_request_id', $ids)->orderBy('id')->lockForUpdate()->get();
            $resolved    = $this->sources->resolve($ids, $user, $branchId);
            if (! isset($context['snapshot']) || ! hash_equals($context['snapshot'], PurchaseRequestPoSourceResolver::sourceVersion($resolved))) {
                throw ValidationException::withMessages(['sources' => __('Purchase request data has changed. Refresh the sources before saving.')]);
            }

            $eligibleItemIds = collect($resolved)->flatMap(fn (array $source): array => array_column($source['items'], 'id'))->all();
            $sourceItems     = $lockedItems->whereIn('id', $eligibleItemIds)->keyBy('id');
            PurchaseOrderBatchRequest::validateSourceItems($data['drafts'], $sourceItems);

            $branch = Branch::find($branchId);
            if (! $branch) {
                throw ValidationException::withMessages(['branch' => __('Select an active branch before creating purchase orders.')]);
            }
            $purchaseOrderIds = [];
            foreach ($data['drafts'] as $draft) {
                unset($draft['id']);
                $draft['branch_id']     = $branchId;
                $draft['branch']        = ['id' => $branch->id, 'code' => $branch->code];
                $draft['created_by_id'] = $user->id;
                $draft['items']         = array_map(function (array $item) use ($sourceItems): array {
                    $source = $sourceItems->get($item['source_item_id']);
                    unset($item['id'], $item['source_item_id']);
                    $item['item']               = ['id' => $source->item_variant_id];
                    $item['unit']               = ['id' => data_get($item, 'unit.id')];
                    $item['referenceable_type'] = PurchaseRequestItem::class;
                    $item['referenceable_id']   = $source->id;

                    return $item;
                }, $draft['items']);
                $purchaseOrderIds[] = $this->purchaseOrders->create($draft)->id;
            }
            $submission->update(['purchase_order_ids' => $purchaseOrderIds]);

            return $submission;
        }, 3);

        session()->forget(PurchaseRequestPoSourceResolver::SESSION_KEY . ".{$data['token']}");

        return $submission;
    }

    private function canonicalize(mixed $value): mixed {
        if (! is_array($value)) {
            return $value;
        }
        if (! array_is_list($value)) {
            ksort($value);
        }

        return array_map($this->canonicalize(...), $value);
    }
}
