<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\PrintTemplateRequest;
use App\Models\Core\PrintTemplate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PrintTemplateController extends Controller
{
    public function __construct(Request $request)
    {
        parent::__construct($request, PrintTemplate::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $this->setBreadcrumbs();
        PrintTemplate::dataTable($request);

        return Inertia::render('Core/PrintTemplate/Index');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(PrintTemplateRequest $request)
    {
        if (! $this->isInertiaRequest($request)) {
            $printTemplate = PrintTemplate::find($request->id);
            $printTemplate->update([
                'template' => $request->data,
                'html' => $request->pagesHtml[0]['html'],
                'css' => $request->pagesHtml[0]['css'],
            ]);

            return response()->json($printTemplate);
        }
        $data = $request->validated();
        DB::beginTransaction();
        $data['permission_id'] = isset($data['permission']) ? $data['permission']['id'] : null;
        $data['model'] = isset($data['permission']) ? $data['permission']['model'] : null;
        $data['name_model'] = isset($data['permission']) ? $data['permission']['name'] : null;

        $data['letter_head_id'] = isset($data['letter_head']) ? $data['letter_head']['id'] : null;

        $printTemplate = PrintTemplate::create($data);
        $printTemplate->logForCreated();
        DB::commit();

        return redirect()->route('printTemplates.show', $printTemplate);
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, PrintTemplate $printTemplates)
    {
        if (! $this->isInertiaRequest($request)) {
            return response()->json($printTemplates->template);
        }
        $this->setBreadcrumbs($printTemplates);
        $printTemplates->showDetail();

        return Inertia::render('Core/PrintTemplate/Show', [
            'printTemplate' => function () use ($printTemplates) {
                $printTemplates->loadRelations();

                return $printTemplates;
            },
        ]);
    }

    public function editor(Request $request, PrintTemplate $printTemplates)
    {
        $this->setBreadcrumbs($printTemplates, __('core/form.editor'));
        $printTemplates->loadRelations();

        return Inertia::render('Core/PrintTemplate/Editor', [
            'printTemplate' => $printTemplates,
            'csrfToken' => csrf_token(),
            'dataTableColumns' => $printTemplates->columns,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(PrintTemplateRequest $request, PrintTemplate $printTemplates)
    {
        $data = $request->validated();
        DB::beginTransaction();
        $data['permission_id'] = isset($data['permission']) ? $data['permission']['id'] : null;
        $data['model'] = isset($data['permission']) ? $data['permission']['model'] : null;
        $data['name_model'] = isset($data['permission']) ? $data['permission']['name'] : null;

        $data['letter_head_id'] = isset($data['letter_head']) ? $data['letter_head']['id'] : null;

        $printTemplates->fillForUpdate($data);
        $printTemplates->logForUpdated();
        DB::commit();

        return redirect()->back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(PrintTemplate $printTemplates)
    {
        DB::beginTransaction();
        $printTemplates->logForDeleted();
        $printTemplates->delete();
        DB::commit();

        return redirect()->route('printTemplates.index');
    }
}
