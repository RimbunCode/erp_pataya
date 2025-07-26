<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\UnitRequest;
use App\Models\Inventory\Unit;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class UnitController extends Controller {
  public function __construct(Request $request) {
    parent::__construct($request, Unit::class);
  }
  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    if (!$this->isInertiaRequest($request)) {
      if ($request->has('group')) {
        $units = Unit::where('group', $request->group)
          ->whereNotNull('conversion_factor');
        if ($request->except) {
          $units->whereNot('id', $request->except);
        }

        return response()->json($units->get());
      }
      return response()->json([]);
    }
    $this->setBreadcrumbs();
    Unit::orderBy('group')->dataTable($request);
    return Inertia::render('Inventory/Units/Index');
  }

  public function getGroups(Request $request, string $search = null) {
    if (!$this->isInertiaRequest($request)) {
      $groups = Unit::select('group')
        ->distinct();
      if ($search) {
        $groups->where('group', 'like', "%{$search}%");
      }
      $groups = $groups->get()
        ->pluck('group');
      if (
        $groups->filter(function ($group) use ($search) {
          return strtolower($group) == strtolower($search);
        })->isNotEmpty()
      ) {
        return response()->json($groups ?? []);
      }
      return response()->json([...($groups ?? []), $search ?? '']);
    }
    abort(404);
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(UnitRequest $request) {
    $data = $request->validated();
    DB::beginTransaction();
    if ($data['customable'] == true) {
      $data['conversion_factor'] = null;
    }
    $unit = Unit::create($data);
    $unit->logs()->create([
      'user_id' => $request->user()->id,
      'activity' => [
        'en' => ':user created this',
        'id' => ':user telah membuat ini',
      ]
    ]);
    DB::commit();
    return redirect()->back();
  }

  /**
   * Display the specified resource.
   */
  public function show(Unit $unit) {
    $this->setBreadcrumbs($unit);
    $unit->showDetail();
    if ($unit->conversion_factor == null) {
      $unit->customable = true;
    }
    return $this->renderShow(
      'Inventory/Units/Form',
      "unit",
      $unit->name,
      $unit,
    );
  }

  /**
   * Update the specified resource in storage.
   */
  public function update(UnitRequest $request, Unit $unit) {
    $data = $request->validated();
    DB::beginTransaction();
    if ($data['customable'] == true) {
      $data['conversion_factor'] = null;
    }
    $unit->update($data);
    $unit->logs()->create([
      'user_id' => $request->user()->id,
      'activity' => [
        'en' => ':user updated this',
        'id' => ':user memperbarui ini',
      ]
    ]);
    DB::commit();
    return redirect()->back();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(Unit $unit) {
    $unit->delete();
    return redirect()->back();
  }
}
