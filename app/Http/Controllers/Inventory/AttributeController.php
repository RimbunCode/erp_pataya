<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\AttributeRequest;
use App\Models\Inventory\Attribute;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AttributeController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, Attribute::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        Attribute::dataTable($request);

        return Inertia::render('Inventory/Attributes/Index');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function create() {
        $this->setBreadcrumbs();

        return $this->renderShow(
            'Inventory/Attributes/Form',
            'attribute',
            null,
            new ($this->model),
        );
    }

    public function store(AttributeRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();
        if (($data['is_numeric'] ?? false) == true) {
            $data['values'] = array_map(fn ($value) => [
                'value' => $value,
            ], range($data['from_range'], $data['to_range'], $data['increment']));
        }

        $attribute = Attribute::create($data);
        $attribute->logForCreated();
        DB::commit();

        return back()->with('id', $attribute->id);
    }

    /**
     * Display the specified resource.
     */
    public function show(Attribute $attribute) {
        $this->setBreadcrumbs($attribute);
        $attribute->showDetail();
        if ($attribute->is_numeric) {
            $attribute->from_range = $attribute->values[0]['value'] ?? 0;
            $attribute->to_range   = $attribute->values[count((array) $attribute->values) - 1]['value'] ?? 0;
            $attribute->increment  = ($attribute->values[1]['value'] ?? 0) - ($attribute->values[0]['value'] ?? 0);
        }

        return $this->renderShow(
            'Inventory/Attributes/Form',
            'attribute',
            $attribute->name,
            $attribute,
        );
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(AttributeRequest $request, Attribute $attribute) {
        $data = $request->validated();
        DB::beginTransaction();
        if (($data['is_numeric'] ?? false) == true) {
            $data['values'] = array_map(fn ($value) => [
                'value' => $value,
            ], range($data['from_range'], $data['to_range'], $data['increment']));
        }
        $attribute->fillForUpdate($data);
        $attribute->logForUpdated();
        DB::commit();

        return back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, Attribute $attribute) {
        DB::beginTransaction();
        try {
            $attribute->delete();
            $attribute->logForDeleted();
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return redirect()->route('attributes.index');
    }
}
