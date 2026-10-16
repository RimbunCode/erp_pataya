<?php

namespace App\Services\Purchase\FromRequests;

use App\Enums\Permission;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Purchase\PurchaseRequestItem;
use App\Models\User\User;
use App\Services\Core\PermissionChecker;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PurchaseRequestPoSourceResolver {
    public const MAX_REQUESTS      = 500;
    public const TOKEN_TTL_MINUTES = 120;
    public const SESSION_KEY       = 'purchase_order_from_requests';

    /** @param list<string> $ids */
    public function stage(array $ids, User $user, ?string $branchId): string {
        $this->resolve($ids, $user, $branchId);
        $this->pruneExpiredTokens();
        $token = (string) Str::ulid();
        session()->put(self::SESSION_KEY . ".{$token}", [
            'ids'        => $ids,
            'user_id'    => $user->id,
            'branch_id'  => $branchId,
            'expires_at' => now()->addMinutes(self::TOKEN_TTL_MINUTES)->timestamp,
        ]);

        return $token;
    }

    /** @return array{ids: list<string>, user_id: string, branch_id: ?string, expires_at: int, snapshot?: string} */
    public function tokenContext(string $token, User $user, ?string $branchId): array {
        abort_unless(Str::isUlid($token), 404);
        $this->pruneExpiredTokens();
        $context = session(self::SESSION_KEY . ".{$token}");
        abort_unless(is_array($context), 404);
        abort_unless($context['user_id'] === $user->id && $context['branch_id'] === $branchId, 403);

        return $context;
    }

    /** @param list<array<string, mixed>> $sources */
    public function rememberSnapshot(string $token, array $sources): void {
        session()->put(self::SESSION_KEY . ".{$token}.snapshot", self::sourceVersion($sources));
    }

    /** @param list<array<string, mixed>> $sources */
    public static function sourceVersion(array $sources): string {
        $version = array_map(fn (array $source): array => [
            'id'            => $source['id'],
            'status'        => $source['status'],
            'required_date' => $source['required_date'],
            'external_note' => $source['external_note'],
            'updated_at'    => $source['updated_at'],
            'items'         => array_map(fn (array $item): array => [
                'id'                 => $item['id'],
                'item_variant_id'    => $item['item_variant_id'],
                'item_unit_id'       => $item['item_unit_id'],
                'conversion_factor'  => $item['conversion_factor'],
                'description'        => $item['description'],
                'required_date'      => $item['required_date'],
                'quantity'           => $item['quantity'],
                'ordered_quantity'   => $item['ordered_quantity'],
                'updated_at'         => $item['updated_at'],
                'unordered_quantity' => $item['unordered_quantity'],
            ], $source['items']),
        ], $sources);

        return hash('sha256', json_encode($version, JSON_THROW_ON_ERROR));
    }

    /**
     * @param  list<string>  $ids
     * @return list<array<string, mixed>>
     */
    public function resolve(array $ids, User $user, ?string $branchId): array {
        $permissions = PermissionChecker::forUser(request());
        abort_unless(request()->user()?->id === $user->id, 403);
        abort_unless($permissions->can(PurchaseOrder::class, Permission::Create), 403);
        foreach ([Permission::Select, Permission::Read] as $action) {
            abort_unless($permissions->can(PurchaseRequest::class, $action), 403);
        }

        $requests = PurchaseRequest::query()
            ->where('branch_id', $branchId)
            ->whereIn('id', $ids)
            ->with(['items.item.defaultUom', 'items.unit'])
            ->get()->keyBy('id');
        $errors  = [];
        $sources = [];
        foreach ($ids as $index => $id) {
            $purchaseRequest = $requests->get($id);
            abort_unless($purchaseRequest, 403);
            foreach ([Permission::Select, Permission::Read] as $action) {
                if ($permissions->isOnlyCreator(PurchaseRequest::class, $action)) {
                    abort_unless($purchaseRequest->created_by_id === $user->id, 403);
                }
            }
            if (! PurchaseRequestPoEligibility::isEligible($purchaseRequest)) {
                $errors["ids.{$index}"] = __(':code is no longer eligible for a purchase order.', ['code' => $purchaseRequest->code]);

                continue;
            }
            $sources[] = [
                'id'            => $purchaseRequest->id,
                'code'          => $purchaseRequest->code,
                'required_date' => $purchaseRequest->required_date,
                'external_note' => $purchaseRequest->external_note,
                'status'        => array_map(fn ($status): string => $status->value, $purchaseRequest->status ?? []),
                'updated_at'    => $purchaseRequest->updated_at?->toISOString(),
                'items'         => $purchaseRequest->items
                    ->filter(fn (PurchaseRequestItem $item): bool => $item->unordered_quantity > 0)
                    ->map(fn (PurchaseRequestItem $item): array => [
                        'id'                  => $item->id,
                        'purchase_request_id' => $purchaseRequest->id,
                        'item_variant_id'     => $item->item_variant_id,
                        'item_unit_id'        => $item->item_unit_id,
                        'item_name'           => $item->item_name,
                        'unit_name'           => $item->unit_name,
                        'item'                => $item->item?->toArray(),
                        'unit'                => $item->unit?->toArray(),
                        'description'         => $item->description,
                        'required_date'       => $item->required_date,
                        'quantity'            => $item->quantity,
                        'ordered_quantity'    => $item->ordered_quantity,
                        'unordered_quantity'  => $item->unordered_quantity,
                        'updated_at'          => $item->updated_at?->toISOString(),
                        'conversion_factor'   => $item->conversion_factor,
                    ])->values()->all(),
            ];
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return $sources;
    }

    private function pruneExpiredTokens(): void {
        foreach (session(self::SESSION_KEY, []) as $token => $context) {
            if (($context['expires_at'] ?? 0) <= now()->timestamp) {
                session()->forget(self::SESSION_KEY . ".{$token}");
            }
        }
    }
}
