<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\PrintTemplateRequest;
use App\Models\Core\PrintTemplate;
use App\Services\Core\PrintTemplate\ExampleDataService;
use App\Services\Core\PrintTemplate\RelationTrackerService;
use App\Services\Core\PrintTemplate\TemplateParserService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PrintTemplateController extends Controller {
    public function __construct(
        Request $request,
        protected TemplateParserService $templateParser,
        protected RelationTrackerService $relationTracker,
        protected ExampleDataService $exampleDataService,
    ) {
        parent::__construct($request, PrintTemplate::class);
    }

    protected function enforcePermission($method) {
        if ($method == 'editor' || $method == 'preview') {
            return ['write', 'create'];
        }
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        PrintTemplate::dataTable($request);

        return Inertia::render('Core/PrintTemplate/Index');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function create() {
        $this->setBreadcrumbs();

        return Inertia::render('Core/PrintTemplate/Show');
    }

    public function store(PrintTemplateRequest $request) {
        if (! $this->isInertiaRequest($request)) {
            $printTemplate = PrintTemplate::find($request->id);

            // Extract relations from the template data and HTML
            $templateData  = $request->data;
            $html          = $request->pagesHtml[0]['html'] ?? '';
            $usedRelations = $this->templateParser->extractRelations(
                is_array($templateData) ? $templateData : ['html' => $html],
            );

            // Also extract from HTML directly for comprehensive coverage
            $htmlRelations = $this->relationTracker->extractRelationsFromHTML($html);
            $usedRelations = $this->relationTracker->normalizeRelations(
                array_merge($usedRelations, $htmlRelations),
            );

            $printTemplate->update([
                'template'       => $templateData,
                'html'           => $html,
                'css'            => $request->pagesHtml[0]['css'],
                'used_relations' => $usedRelations,
            ]);

            return response()->json([
                'id'             => $printTemplate->id,
                'used_relations' => $printTemplate->used_relations,
                'updated_at'     => $printTemplate->updated_at,
            ]);
        }
        $data = $request->validated();
        DB::beginTransaction();
        $data['permission_id'] = isset($data['permission']) ? $data['permission']['id'] : null;
        $data['model']         = isset($data['permission']) ? $data['permission']['model'] : null;
        $data['name_model']    = isset($data['permission']) ? $data['permission']['name'] : null;

        $data['letter_head_id'] = isset($data['letter_head']) ? $data['letter_head']['id'] : null;

        $printTemplate = PrintTemplate::create($data);
        $printTemplate->logForCreated();
        DB::commit();

        return redirect()->route('printTemplates.show', $printTemplate)->with('id', $printTemplate->id);
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, PrintTemplate $printTemplate) {
        if (! $this->isInertiaRequest($request)) {
            return response()->json($printTemplate->template);
        }
        $this->setBreadcrumbs($printTemplate);
        $printTemplate->showDetail();

        return Inertia::render('Core/PrintTemplate/Show', [
            'printTemplate' => function () use ($printTemplate) {
                $printTemplate->loadRelations();

                return $printTemplate;
            },
        ]);
    }

    public function editor(Request $request, PrintTemplate $printTemplate) {
        $this->setBreadcrumbs($printTemplate, __('core/form.editor'));
        $printTemplate->loadRelations();
        $usedRelations                                               = $printTemplate?->getUsedRelations() ?? [];
        ['relations' => $validRelations, 'modelColumns' => $columns] = $this->relationTracker->validateRelations($printTemplate->model, $usedRelations, true);

        return Inertia::render('Core/PrintTemplate/Editor', [
            'printTemplate'    => $printTemplate,
            'csrfToken'        => csrf_token(),
            'columns'          => $columns ?? [],
            'dataTableColumns' => $printTemplate->columns,
        ]);
    }

    /**
     * Preview template with example data.
     *
     * Accepts template HTML/CSS in the request body, extracts relations,
     * loads example data with those relations, and returns the rendered
     * data for frontend Handlebar compilation.
     */
    public function preview(
        Request $request,
        PrintTemplate $printTemplate,
    ) {
        $request->validate([
            'template' => ['required', 'array'],
        ]);

        $template = $request->input('template');
        $warnings = [];

        // Extract relations from the submitted template
        $relations = $this->relationTracker->extractRelations($template);

        // Validate relations against the model
        $modelClass = $printTemplate->model;

        if ($modelClass && class_exists($modelClass)) {
            ['relations' => $validRelations, 'modelColumns' => $columns] = $this->relationTracker->validateRelations($modelClass, $relations, true);

            // Warn about invalid relations
            $invalidRelations = array_diff($relations, $validRelations);
            foreach ($invalidRelations as $invalidRelation) {
                $warnings[] = "Relation '{$invalidRelation}' does not exist on model.";
            }
        } else {
            $warnings[] = 'No model configured for this template.';
        }

        // Get example data with the extracted relations
        $exampleData = null;
        if ($modelClass) {
            $exampleData = $this->exampleDataService->getExampleDataWithRelations($modelClass, $validRelations ?? []);

            if (! $exampleData) {
                $warnings[] = 'No example data available for this model. Preview will show placeholder values.';
            }
        }

        // Get HTML and CSS from the template data
        $html = $template['html'] ?? $printTemplate->html ?? '';
        $css  = $template['css'] ?? $printTemplate->css ?? '';

        return response()->json([
            'html'          => $html,
            'css'           => $css,
            'exampleData'   => $exampleData,
            'usedRelations' => $validRelations ?? [],
            'columns'       => $columns ?? [],
            'warnings'      => $warnings,
        ]);
    }

    /**
     * Generate example data for the template model.
     */
    public function generateExampleData(
        PrintTemplate $printTemplate,
    ) {
        $modelClass = $printTemplate->model;

        if (! $modelClass || ! class_exists($modelClass)) {
            return response()->json([
                'message' => 'Model template tidak valid untuk generate example data.',
            ], 422);
        }

        if ($this->exampleDataService->hasExampleData($modelClass)) {
            return response()->json([
                'message' => 'Example data sudah tersedia.',
            ]);
        }

        $generated = $this->exampleDataService->generateExampleData($modelClass, 1);

        if ($generated->isEmpty()) {
            return response()->json([
                'message' => 'Gagal membuat example data. Pastikan factory model tersedia.',
            ], 422);
        }

        return response()->json([
            'message' => 'Example data berhasil dibuat.',
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(PrintTemplateRequest $request, PrintTemplate $printTemplate) {
        $data = $request->validated();
        DB::beginTransaction();
        $data['permission_id'] = isset($data['permission']) ? $data['permission']['id'] : null;
        $data['model']         = isset($data['permission']) ? $data['permission']['model'] : null;
        $data['name_model']    = isset($data['permission']) ? $data['permission']['name'] : null;

        $data['letter_head_id'] = isset($data['letter_head']) ? $data['letter_head']['id'] : null;

        $printTemplate->fillForUpdate($data['is_letter_head'] ? [
            'is_letter_head' => $data['is_letter_head'],
            'name'           => $data['name'],
            'is_default'     => $data['is_default'],
        ] : $data);

        // Re-extract used_relations if model changed and template has content
        if ($printTemplate->isDirty('model') && $printTemplate->template) {
            $printTemplate->setUsedRelationsFromTemplate();
        }

        $printTemplate->logForUpdated();
        DB::commit();

        return redirect()->back();
    }
}
