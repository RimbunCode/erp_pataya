<?php

namespace App\Http\Controllers\Core;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Http\Requests\Core\NumberCardRequest;
use App\Models\Core\NumberCard;
use App\Services\Core\NumberCardService;
use App\Services\Core\PermissionChecker;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;

class NumberCardController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, NumberCard::class);
    }

    protected function enforcePermission(string $method) {
        return match ($method) {
            'getValue' => 'select',
            default    => null,
        };
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        $this->scopeVisible(NumberCard::query(), $request)->dataTable($request);

        return Inertia::render('Settings/NumberCard/Index');
    }

    public function create() {
        $this->setBreadcrumbs();

        return Inertia::render('Settings/NumberCard/Show');
    }

    public function store(NumberCardRequest $request) {
        $data = $this->prepareData($request);
        $card = NumberCard::create($data);
        $this->syncAssignables($card, $request->input('assignables', []));

        return redirect()->back()->with('id', $card->id);
    }

    public function show(NumberCard $numberCard) {
        $this->setBreadcrumbs($numberCard);
        $numberCard->showDetail();

        return Inertia::render('Settings/NumberCard/Show', [
            'numberCard' => function () use ($numberCard) {
                $numberCard->loadRelations();

                return $numberCard;
            },
        ]);
    }

    public function edit(NumberCard $numberCard) {
        //
    }

    public function update(NumberCardRequest $request, NumberCard $numberCard) {
        $data = $this->prepareData($request);
        $numberCard->fillForUpdate($data);
        $this->syncAssignables($numberCard, $request->input('assignables', []));

        return redirect()->back();
    }

    private function prepareData(NumberCardRequest $request): array {
        $data = $request->validated();
        if ($request->input('source_type') === 'document_type') {
            $data['model_id']    = $data['model']['id'];
            $data['model_class'] = $data['model']['model'];
        }
        $data['created_by_id'] = $request->user()->id;
        unset($data['model'], $data['assignables']);

        return $data;
    }

    private function syncAssignables(NumberCard $card, array $assignables): void {
        $card->assignables()->delete();
        foreach ($assignables as $row) {
            $card->assignables()->create([
                'assignable_id'   => $row['assignable']['id'],
                'assignable_type' => $row['assignable']['type'],
            ]);
        }
    }

    /**
     * Requirement 8.1/8.2: OR-gate — permission Select ke model_class ATAU
     * is_shared_all/assignable — dua kondisi independen, SALAH SATU cukup.
     */
    private function scopeVisible(Builder $query, Request $request): Builder {
        $user    = $request->user();
        $checker = PermissionChecker::forUser($request);
        $roleIds = $user->roles()->pluck('id')->all();

        $permittedClasses = NumberCard::query()
            ->whereNotNull('model_class')
            ->distinct()
            ->pluck('model_class')
            ->filter(fn ($class) => $checker->can($class, Permission::Select))
            ->all();

        return $query
            ->where(fn (Builder $q) => $q->whereIn('model_class', $permittedClasses))
            ->orWhere(fn (Builder $q) => $q->visibleByShare($user, $roleIds));
    }

    /**
     * Requirement 8.4: re-cek gate PER REQUEST — konfigurasi block yang
     * sudah tersimpan tidak dipercaya begitu saja (permission user bisa
     * berubah sejak block ditempel di Desk).
     */
    private function assertVisible(NumberCard $card, Request $request): void {
        $checker = PermissionChecker::forUser($request);
        $roleIds = $request->user()->roles()->pluck('id')->all();

        $visible = ($card->model_class && $checker->can($card->model_class, Permission::Select))
            || $card->isSharedWith($request->user(), $roleIds);

        abort_unless($visible, 403);
    }

    public function getValue(Request $request, NumberCard $numberCard, NumberCardService $service) {
        $this->assertVisible($numberCard, $request);

        $filters = $request->input('filters', []);
        $value   = $service->getValue($numberCard, $filters);

        return response()->json([
            'value'      => $value,
            'percentage' => $service->getPercentageDifference($numberCard, $filters, $value),
        ]);
    }
}
