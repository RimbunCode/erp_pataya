<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\PreviewFilterTemplateRequest;
use App\Http\Requests\Core\StoreFilterTemplateRequest;
use App\Http\Requests\Core\UpdateFilterTemplateRequest;
use App\Models\Core\SavedFilter;
use App\Services\Core\FilterEvaluator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class FilterTemplateController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, SavedFilter::class);
    }

    /**
     * Method custom (bukan salah satu key match() bawaan di Controller.php)
     * di-map manual ke permission key standar. preview/models = baca data
     * (setara 'read'); setDefault = mutasi (setara 'write').
     */
    protected function enforcePermission($method) {
        return match ($method) {
            'preview'    => 'read',
            'setDefault' => 'write',
            default      => null,
        };
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        SavedFilter::sharedListing($request->model)->dataTable($request);

        return Inertia::render('Core/FilterTemplate/Index');
    }

    public function create() {
        $this->setBreadcrumbs();

        return Inertia::render('Core/FilterTemplate/Show');
    }

    public function store(StoreFilterTemplateRequest $request) {
        $data = $request->validated();

        $savedFilter = SavedFilter::create([
            'user_id'   => $request->user()->id,
            'model'     => $data['model'],
            'filter'    => $data['filter'],
            'name'      => $data['name'],
            'sort'      => $data['sort'] ?? null,
            'is_saved'  => true,
            'is_shared' => true,
        ]);

        return redirect()->route('filterTemplates.show', $savedFilter)->with('id', $savedFilter->id);
    }

    public function show(SavedFilter $filterTemplate) {
        $this->setBreadcrumbs($filterTemplate);

        return Inertia::render('Core/FilterTemplate/Show', [
            'filterTemplate' => function () use ($filterTemplate) {
                $filterTemplate->loadRelations();

                return $filterTemplate;
            },
        ]);
    }

    public function update(UpdateFilterTemplateRequest $request, SavedFilter $filterTemplate) {
        $data       = $request->validated();
        $attributes = [];
        if (array_key_exists('name', $data) && $data['name'] !== null) {
            $attributes['name'] = $data['name'];
        }
        if (array_key_exists('filter', $data) && $data['filter'] !== null) {
            $attributes['filter'] = $data['filter'];
        }
        if (array_key_exists('sort', $data)) {
            $attributes['sort'] = $data['sort'];
        }

        if ($attributes !== []) {
            $filterTemplate->fillForUpdate($attributes);
        }

        return redirect()->back();
    }

    /**
     * Tandai shared filter sebagai default untuk model-nya. Transaksi: lepas
     * default lama (model sama) sebelum set yang baru — memastikan maksimal
     * satu default aktif per model (Correctness Property P1).
     */
    public function setDefault(SavedFilter $filterTemplate): JsonResponse {
        abort_unless($filterTemplate->is_shared, 422, 'Hanya shared filter yang bisa dijadikan default.');

        DB::transaction(function () use ($filterTemplate) {
            SavedFilter::defaultFor($filterTemplate->model)
                ->where('id', '!=', $filterTemplate->id)
                ->update(['is_default' => false]);

            $filterTemplate->update(['is_default' => true]);
        });

        return response()->json(['id' => $filterTemplate->id, 'is_default' => true]);
    }

    /**
     * Preview data nyata (maks 5 row) dari filter+sort yang sedang disusun —
     * BOLEH draft/belum tersimpan. Murni read, tidak menyimpan/mengubah apa pun.
     */
    public function preview(PreviewFilterTemplateRequest $request): JsonResponse {
        /** @var class-string $model */
        $model   = $request->input('model');
        $columns = $model::getColumns(1);

        $query = $model::query();
        $tree  = $request->input('filter') ?? ['root' => ['k' => 'and', 'c' => []]];
        (new FilterEvaluator($columns))->apply($query, $tree);

        if ($sort = $request->input('sort')) {
            $desc = str_starts_with($sort, '-');
            $query->orderBy($desc ? substr($sort, 1) : $sort, $desc ? 'desc' : 'asc');
        }

        // Kolom dibatasi show=true di getColumns (kolom yg memang tampil di
        // list page model itu) — bukan safeLookupColumns ModelController
        // (itu untuk endpoint publik lintas-user; preview sudah di-gate
        // permission 'read' pada SavedFilter).
        $visible = collect($columns)->where('show', true)->pluck('name')->push('id')->unique()->values();
        $rows    = $query->limit(5)->get($visible->all());

        return response()->json([
            'columns' => $columns,
            'data'    => $rows,
        ]);
    }
}
