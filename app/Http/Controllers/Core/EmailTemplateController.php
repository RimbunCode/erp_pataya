<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\EmailTemplateRequest;
use App\Jobs\SendEmailNotificationJob;
use App\Models\Core\EmailTemplate;
use App\Models\User\Permission;
use App\Notifications\EmailTemplateTestNotification;
use App\Services\Core\EmailTemplate\EmailTemplateRenderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Throwable;

class EmailTemplateController extends Controller {
    public function __construct(
        Request $request,
        protected EmailTemplateRenderService $renderService,
    ) {
        parent::__construct($request, EmailTemplate::class);
    }

    protected function enforcePermission($method) {
        if ($method == 'fields' || $method == 'testSend') {
            return ['write', 'create'];
        }
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        EmailTemplate::dataTable($request);

        return Inertia::render('Core/EmailTemplate/Index');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create() {
        $this->setBreadcrumbs();

        return Inertia::render('Core/EmailTemplate/Show');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(EmailTemplateRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();
        $data['permission_id'] = isset($data['permission']) ? $data['permission']['id'] : null;
        $data['model']         = isset($data['permission']) ? $data['permission']['model'] : null;
        $data['name_model']    = isset($data['permission']) ? $data['permission']['name'] : null;

        $emailTemplate = EmailTemplate::create($data);
        $emailTemplate->logForCreated();
        DB::commit();

        return redirect()->route('emailTemplates.show', $emailTemplate)->with('id', $emailTemplate->id);
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, EmailTemplate $emailTemplate) {
        $this->setBreadcrumbs($emailTemplate);
        $emailTemplate->showDetail();

        return Inertia::render('Core/EmailTemplate/Show', [
            'emailTemplate' => function () use ($emailTemplate) {
                $emailTemplate->loadRelations();

                return $emailTemplate;
            },
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(EmailTemplateRequest $request, EmailTemplate $emailTemplate) {
        $data = $request->validated();
        DB::beginTransaction();
        $data['permission_id'] = isset($data['permission']) ? $data['permission']['id'] : null;
        $data['model']         = isset($data['permission']) ? $data['permission']['model'] : null;
        $data['name_model']    = isset($data['permission']) ? $data['permission']['name'] : null;

        $emailTemplate->fillForUpdate($data);
        $emailTemplate->logForUpdated();
        DB::commit();

        return redirect()->back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(EmailTemplate $emailTemplate) {
        DB::beginTransaction();
        $emailTemplate->logForDeleted();
        $emailTemplate->delete();
        DB::commit();

        return redirect()->route('emailTemplates.index');
    }

    /**
     * Daftar field yang tersedia untuk merge-tag, berdasarkan Model target.
     */
    public function fields(Request $request): JsonResponse {
        $request->validate([
            'model' => ['required', 'string'],
        ]);

        $modelClass = $request->input('model');

        // Hanya izinkan FQCN yang terdaftar sebagai Permission::model — mencegah
        // pemanggilan ::getColumns() statis pada class sembarang yang kebetulan exist.
        if (! class_exists($modelClass) || ! Permission::where('model', $modelClass)->exists()) {
            return response()->json([]);
        }

        $columns = array_values(array_filter(
            $modelClass::getColumns(2),
            fn ($col) => ($col['name'] ?? null) !== ($col['primaryKey'] ?? null),
        ));

        return response()->json($columns);
    }

    /**
     * Kirim email uji coba menggunakan data contoh ke alamat user yang sedang login.
     */
    public function testSend(EmailTemplate $emailTemplate) {
        if (! $emailTemplate->model) {
            return back()->with('alert', [
                'message' => __('core.emailTemplate.testSend.noModel'),
            ]);
        }

        $modelClass = $emailTemplate->model;
        $doc        = $modelClass::exampleData()->first();

        if (! $doc) {
            return back()->with('alert', [
                'message' => __('core.emailTemplate.testSend.noExampleData'),
            ]);
        }

        $rendered = $this->renderService->render($emailTemplate, $doc);

        try {
            SendEmailNotificationJob::dispatch(
                auth()->user(),
                new EmailTemplateTestNotification($rendered['subject'], $rendered['body']),
            );
        } catch (Throwable $e) {
            return back()->with('alert', [
                'message' => __('core.emailTemplate.testSend.failed'),
            ]);
        }

        return back()->with('success', __('core.emailTemplate.testSend.success'));
    }
}
