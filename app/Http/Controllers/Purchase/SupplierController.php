<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Http\Requests\Purchase\SupplierRequest;
use App\Models\Purchase\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class SupplierController extends Controller
{
    public function __construct(Request $request)
    {
        parent::__construct($request, Supplier::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $this->setBreadcrumbs();
        Supplier::dataTable($request);

        return Inertia::render('Purchase/Suppliers/Index');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $this->setBreadcrumbs('__(purchase.supplier.new)');

        return Inertia::render('Purchase/Suppliers/Show');
    }

    public function store(SupplierRequest $request)
    {
        $data = $request->validated();
        DB::beginTransaction();
        if (isset($data['country'])) {
            $data['country_id'] = $data['country']['code'];
        }
        $data['parent_id'] = (isset($data['branch_of']) && $data['branch_of']['id'] != null) ? $data['branch_of']['id'] : null;
        $supplier = Supplier::create($data);
        $supplier->logForCreated();
        DB::commit();

        return back()->with('id', $supplier->id);
    }

    public function show(Request $request, Supplier $supplier)
    {

        $this->setBreadcrumbs($supplier);
        $supplier->showDetail();

        return $this->renderShow(
            'Purchase/Suppliers/Form',
            'supplier',
            $supplier->name,
            $supplier
        );
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function update(SupplierRequest $request, Supplier $supplier)
    {
        $data = $request->validated();
        DB::beginTransaction();
        if (isset($data['country'])) {
            $data['country_id'] = $data['country']['code'];
        }
        $data['parent_id'] = (isset($data['branch_of']) && $data['branch_of']['id'] != null) ? $data['branch_of']['id'] : null;
        $supplier->fillForUpdate($data);
        $supplier->logForUpdated();
        DB::commit();

        return back();
    }

    public function destroy(Supplier $supplier)
    {
        DB::beginTransaction();
        $supplier->delete();
        $supplier->logForDeleted();
        DB::commit();

        return back();
    }
}
