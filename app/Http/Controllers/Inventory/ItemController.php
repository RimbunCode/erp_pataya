<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Models\Inventory\Item;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ItemController extends Controller {
  public function __construct(request $request) {
    parent::__construct($request, Item::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    Item::dataTable($request);
    return Inertia::render('Inventory/Items/Index');
  }

  /**
   * Show the form for creating a new resource.
   */
  public function create() {
    //
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(Request $request) {
  }

  /**
   * Display the specified resource.
   */
  public function show(Item $item) {
    //
  }

  /**
   * Show the form for editing the specified resource.
   */
  public function edit(Item $item) {
    //
  }

  /**
   * Update the specified resource in storage.
   */
  public function update(Request $request, Item $item) {
    //
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(Item $item) {
    //
  }
}
