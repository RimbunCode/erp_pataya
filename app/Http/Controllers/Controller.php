<?php

namespace App\Http\Controllers;

use App\Http\Requests\Core\AssigneeRequest;
use App\Http\Requests\Core\CommentRequest;
use App\Http\Requests\Core\EmailTemplateSendRequest;
use App\Http\Requests\Core\TagRequest;
use App\Jobs\Core\SendEmailWithPdfJob;
use App\Models\Core\EmailTemplate;
use App\Models\Core\File;
use App\Models\Core\Fileable;
use App\Models\Core\Log;
use App\Models\Core\PrintTemplate;
use App\Models\Core\Tag;
use App\Models\Core\Taggable;
use App\Models\Core\Todo;
use App\Models\Sales\SalesOrder;
use App\Models\User\Permission;
use App\Models\User\User;
use App\Services\Core\EmailTemplate\EmailTemplateRenderService;
use App\Services\Core\PrintTemplate\HTMLSanitizerService;
use App\Services\Core\PrintTemplate\PdfAttachmentService;
use App\Services\Core\PrintTemplate\PdfExportService;
use App\Services\Core\PrintTemplate\RelationTrackerService;
use App\Services\Core\TodoService;
use App\Utils;
use Exception;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log as LogFacade;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Inertia\Inertia;

abstract class Controller {
    protected string $model;
    protected $service;
    protected $permissions;
    protected $modelPermissions;
    protected $onlyCreator = false;
    protected string $lang;
    protected bool $ignorePermission = false;

    /**
     * Summary of setBreadcrumbs
     *
     * @param  (Model|string)[]  $models
     * @return void
     */
    protected function setBreadcrumbs(Model|string ...$models) {
        $instanceModel = new $this->model;
        if (empty($models)) {
            $breadcrumbs = [['name' => ($instanceModel->translateKey ?? '') . '.title']];
        } else {
            $breadcrumbs = [];
            /**
             * @var Model $model
             */
            foreach ($models as $key => $model) {
                if (\gettype(value: $model) == 'string') {
                    if ($key == 0) {
                        $breadcrumbs[] = ['name' => ($instanceModel->translateKey ?? '') . '.title', 'link' => route("{$instanceModel->route}.index")];
                    }
                    $breadcrumbs[] = ['name' => $model];
                    break;
                }
                if ($key == 0) {
                    $breadcrumbs[] = ['name' => ($instanceModel->translateKey ?? '') . '.title', 'link' => route("{$model->route}.index")];
                    $name          = $model->templateLink ? Utils::convertTemplateLink($model) : Arr::get($model->toArray(), $model->keyBreadcrumb ?? '', $model->name);
                    $breadcrumbs[] = ($key == (count($models) - 1)) ?
                        ['name' => $name] :
                        ['name' => $name, 'link' => route("{$model->route}.show", $model->id)];

                    continue;
                }
                preg_match('/([^\\\\]+)$/', \get_class($model), $className);
                $alias         = $model->aliasBreadcrumb ?? $className[1];
                $value         = Arr::get($model->toArray(), $model->keyBreadcrumb ?? '', $model->name);
                $breadcrumbs[] = ($key == (count($models) - 1)) ?
                    ['name' => "{$alias}: {$value}"] :
                    ['name' => "{$alias}: {$value}", 'link' => route("{$model->route}.show", $model->id)];
            }
        }
        Inertia::share([
            'breadcrumbs' => $breadcrumbs,
        ]);
    }

    protected function guard(array|string $action, int $level = 0) {
        return $this->model::_checkPermission($action, $level);
    }

    /**
     * Summary of exceptPermission
     *
     * @return null|bool
     */
    protected function exceptPermission(string $method) {
        return null;
    }

    /**
     * Summary of enforcePermission
     *
     * @return null|string|string[]|bool
     */
    protected function enforcePermission(string $method) {
        return null;
    }

    public function __construct(Request $request, ?string $model = null) {
        if (! $model) {
            return;
        }
        $this->lang  = $request->cookie('lang') ?? 'en';
        $this->model = $model;
        if (! $model) {
            return;
        }
        Inertia::share([
            'model'        => $model,
            'translateKey' => (new $model)->translateKey ?? null,
        ]);

        $ignorePermission = method_exists($this->model, 'ignoresPermission')
            ? $this->model::ignoresPermission()
            : $this->ignorePermission;

        if (! $ignorePermission && ! $request->attributes->get('isApprovalCallback')) {
            $currentRoute = Route::getCurrentRoute();
            $method       = $currentRoute->getActionMethod();

            $customPermission = $this->exceptPermission($method) || $method == 'createPrintTemplate';
            if (! ($request->hasValidSignature() && $request->user()->id == ($request->u ?? ''))) {
                if ($customPermission != true) {
                    $this->permissions      = $request->session()->get('permissions');
                    $this->modelPermissions = $this->permissions[$this->model] ?? null;
                    if ($this->modelPermissions === null) {
                        abort(403);
                    }
                    $keyPermission = match ($method) {
                        'index'        => 'select',
                        'create'       => 'create',
                        'store'        => 'create',
                        'show'         => 'read',
                        'update'       => 'write',
                        'destroy'      => 'delete',
                        'import'       => 'import',
                        'export'       => 'export',
                        'share'        => 'share',
                        'submit'       => 'submit',
                        'cancel'       => 'cancel',
                        'print'        => 'print',
                        'printPdf'     => 'print',
                        'emailPreview' => 'print',
                        'sendEmail'    => 'print',
                        'amend'        => 'amend',
                        'addComment',
                        'editComment',
                        'addTag',
                        'addFile',
                        'removeFile',
                        'removeComment',
                        'removeTag',
                        'addAssignee',
                        'removeAssignee' => 'read',
                        default          => $this->enforcePermission($method),
                    };
                    if ($keyPermission) {
                        $this->onlyCreator = $this->guard($keyPermission, 0);
                        $request->merge(['onlyCreator' => $this->onlyCreator ?? false]);

                        foreach ($currentRoute->parameters() as $value) {
                            if (\is_string($value)) {
                                continue;
                            }
                            if (\get_class($value) === $this->model) {
                                $data = $value;
                            }
                        }
                        if (isset($data)) {
                            $allowed = $this->onlyCreator ? $data?->created_by_id == $request->user()->id : true;
                            if (! $allowed) {
                                abort(403);
                            }
                        }
                    } else {
                        abort(403);
                    }
                }
            }
        }
    }

    protected function isInertiaRequest(Request $request) {
        if (! $request->ajax()) {
            return true;
        }

        return $request->header('X-Inertia') == 'true' || $request->header('X-Inertia-Partial') == 'true';
    }

    public function addComment(CommentRequest $request, $param, HTMLSanitizerService $sanitizer) {
        $request->validated();

        preg_match_all('/data-id="([^"]+)"/', $request->comment, $matches);

        $usersMentioned = collect($matches[1])->unique();
        if ($usersMentioned->count() > 0) {
            $users = User::whereIn('id', $usersMentioned)->get();
        }

        Log::create([
            'user_id'       => $request->user()->id,
            'loggable_id'   => $param,
            'loggable_type' => $this->model,
            'type'          => 'comment',
            'activity'      => $sanitizer->sanitize($request->comment)->sanitizedHTML,
            'comment_json'  => $request->comment_json,
        ]);

        return back();
    }

    public function editComment(CommentRequest $request, $param, Log $id, HTMLSanitizerService $sanitizer) {
        if ($id->user_id != $request->user()->id || $id->type != 'comment') {
            return back()->with('alert', [
                'message' => 'Failed to edit comment',
            ]);
        }

        $id->update([
            'activity'     => $sanitizer->sanitize($request->comment)->sanitizedHTML,
            'comment_json' => $request->comment_json,
        ]);

        return back();
    }

    protected function renderShow($formPathname, $name, $title, $data, $props = [], $settings = []) {
        $isCreate = $data instanceof Model ? ! $data->exists : false;

        return Inertia::render('ShowGeneral', array_merge([
            'isCreate'     => $isCreate,
            'name'         => $name,
            'title'        => $title,
            'formPathname' => $formPathname ?? (new $this->model)->formComponent ?? '',
            $name          => $data,
        ], [...$props, 'settings' => $settings]));
    }

    public function removeComment(Request $request, $param, Log $id) {
        if ($id->user_id != $request->user()->id || ! $id || $id->type != 'comment') {
            return back()->with('alert', [
                'message' => 'Failed remove comment',
            ]);
        }
        $id->delete();

        return back()->with('alert', [
            'message' => 'Failed remove comment',
        ]);
    }

    public function addTag(TagRequest $request, $param) {
        $request->validated();

        if ($request->new) {
            $tag = Tag::create([
                'name' => $request->name,
            ]);
            $tag->logs()->create([
                'user_id'  => $request->user()->id,
                'activity' => [
                    'en' => ':user created this',
                    'id' => ':user telah membuat ini',
                ],
            ]);
        }
        $tag = $request->isNew ? Tag::create([
            'name' => $request->name,
        ]) : Tag::find($request->id);

        Taggable::create([
            'taggable_id'   => $param,
            'taggable_type' => $this->model,
            'tag_id'        => $tag->id,
        ]);

        return back();
    }

    public function removeTag(Request $request, $param, Tag $id) {
        Taggable::where('taggable_id', $param)
            ->where('taggable_type', operator: $this->model)
            ->where('tag_id', $id->id)->delete();

        return back();
    }

    public function addFile(Request $request, $param) {
        DB::beginTransaction();
        preg_match('/[^\\\\]+$/', $this->model, $folderName);

        File::uploadFile($request, $folderName[0], function ($file) use ($param) {
            Fileable::create([
                'fileable_id'   => $param,
                'fileable_type' => $this->model,
                'file_id'       => $file->id,
            ]);
        });
        DB::commit();

        return back();
    }

    public function removeFile(Request $request, $param, File $id) {
        try {
            Fileable::where('fileable_id', $param)
                ->where('fileable_type', $this->model)
                ->where('file_id', $id->id)->delete();
        } catch (Exception $e) {
            // dd($e);
        }

        return back();
    }

    public function addAssignee(AssigneeRequest $request, $param) {
        $data                   = $request->validated();
        $data['reference_id']   = $param;
        $data['reference_type'] = $this->model;

        app(TodoService::class)->createForReference($data);

        return back();
    }

    public function removeAssignee(Request $request, $param, Todo $id) {
        if ($id->reference_id !== $param || $id->reference_type !== $this->model) {
            abort(404);
        }

        $id->delete();

        return back();
    }

    public function print(Request $request, mixed $id, ?PrintTemplate $printTemplate = null) {
        $data = $this->model::find($id);
        $this->setBreadcrumbs($data, __('core/form.print_preview'));

        // Resolve the print template first so we can use its used_relations
        $printTemplate ??= PrintTemplate::where('model', $this->model)
            ->where('is_default', true)
            ->first();

        // Use template's used_relations for optimized eager loading when available
        $usedRelations = $printTemplate?->getUsedRelations() ?? [];

        $relationTracker                                             = app(RelationTrackerService::class);
        ['relations' => $validRelations, 'modelColumns' => $columns] = $relationTracker->validateRelations($this->model, $usedRelations, true);
        $data->load($validRelations);

        $printTemplate->loadRelations();

        $docInfo = [
            'doc_name' => $data->translateKey . '.name',
        ];

        return Inertia::render('Core/Print', [
            'doc'           => $data,
            'docInfo'       => $docInfo,
            'columns'       => $columns,
            'printTemplate' => $printTemplate->toArray(),
        ]);
    }

    public function printPdf(Request $request, mixed $id, PrintTemplate $printTemplate) {
        $request->validate([
            'html' => ['required', 'string', 'max:5242880'],
        ]);

        $data = $this->model::findOrFail($id);

        $docInfo = [
            'doc_name' => $data->translateKey . '.name',
        ];

        $pdf      = app(PdfExportService::class)->generate($request->string('html')->toString(), $printTemplate);
        $filename = Str::slug(__($docInfo['doc_name']) . '-' . $data->id);

        try {
            app(PdfAttachmentService::class)->attach($pdf, $data);
        } catch (Exception $e) {
            // Attaching is a side effect of a successful manual download —
            // a failure here must not prevent the user from receiving the
            // PDF they just generated.
            LogFacade::error('PDF manual-download attach failed', [
                'model'   => $this->model,
                'id'      => $id,
                'message' => $e->getMessage(),
            ]);
        }

        return response($pdf, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => "attachment; filename=\"{$filename}.pdf\"",
        ]);
    }

    public function emailPreview(Request $request, mixed $id, ?EmailTemplate $emailTemplate = null) {
        $data = $this->model::findOrFail($id);

        $compiled = $emailTemplate
            ? app(EmailTemplateRenderService::class)->render($emailTemplate, $data)
            : ['subject' => '', 'body' => ''];

        $recipient = $emailTemplate?->recipient_path
            ? data_get($data, $emailTemplate->recipient_path)
            : null;

        $attachableFiles = Fileable::where('fileable_id', $data->id)
            ->where('fileable_type', $this->model)
            ->with('file')
            ->get()
            ->map(fn ($f) => [
                'id'             => $f->file->id,
                'name'           => $f->file->fullname,
                'isGeneratedPdf' => $f->is_generated_pdf,
            ]);

        $hasGeneratedPdf = $attachableFiles->contains('isGeneratedPdf', true);

        // Nilai aktual (bukan nama field) untuk mention di dialog trigger —
        // beda dari emailTemplates.fields (spec 1) yang hanya kirim nama field
        // tanpa nilai, karena spec 1 untuk authoring template (belum ada dokumen nyata).
        // Hanya kolom non-relasi (getColumns(0), tanpa nameOfFunction) yang
        // diproses — kolom relasi (hasMany/belongsTo dst) butuh eager-load
        // tersendiri untuk aman diakses, di luar scope mention field sederhana.
        $resolvedFields = collect($this->model::getColumns(0))
            ->reject(fn ($col) => isset($col['nameOfFunction']))
            ->reject(fn ($col) => is_array(data_get($data, $col['name'])) || is_object(data_get($data, $col['name'])))
            ->map(fn ($col) => [
                'id'    => "doc.{$col['name']}",
                'label' => $col['titleTrans'] ?? $col['name'],
                'value' => (string) (data_get($data, $col['name']) ?? ''),
            ])->filter(fn ($f) => $f['value'] !== '')->values();

        return response()->json([
            'subject'         => $compiled['subject'],
            'body'            => $compiled['body'],
            'recipient'       => $recipient,
            'fromAddress'     => config('mail.from.address'),
            'fromName'        => auth()->user()->name,
            'files'           => $attachableFiles,
            'hasGeneratedPdf' => $hasGeneratedPdf,
            // Syarat checkbox "Sertakan PDF" bisa ditampilkan sama sekali —
            // tanpa PrintTemplate default, tidak ada dasar untuk merender nanti.
            'canOfferPdf'    => $hasGeneratedPdf || PrintTemplate::where('model', $this->model)->where('is_default', true)->exists(),
            'resolvedFields' => $resolvedFields,
        ]);
    }

    public function sendEmail(EmailTemplateSendRequest $request, mixed $id) {
        $data = $request->validated();

        SendEmailWithPdfJob::dispatch(
            $this->model,
            $id,
            $data['to'],
            $data['cc'] ?? [],
            $data['bcc'] ?? [],
            $data['subject'],
            $data['body'],
            $data['fileIds'] ?? [],
            (bool) ($data['include_pdf'] ?? false),
            $data['from_name'] ?? null,
        );

        return back()->with('success', __('core.emailTemplate.send.queued'));
    }

    public function createPrintTemplate() {
        $model         = Permission::where('model', $this->model)->first();
        $printTemplate = PrintTemplate::create([
            'model'      => $this->model,
            'name'       => "{$model->name}-" . Utils::generateRandom(5),
            'name_model' => $model->name,
        ]);

        return redirect()->route('printTemplates.show', $printTemplate);
    }

    public function amend(string $id) {
        $data = $this->model::findOrFail($id);
        if (! $data) {
            return back();
        }

        $test = new SalesOrder;

        $newData = $data->amend();

        $currentRoute = Route::getCurrentRoute();
        $route        = Str::before($currentRoute->getAction()['as'], '.') . '.show';

        return redirect()->route($route, $newData->id);
    }

    public function cancel(string $id) {
        $data = $this->model::findOrFail($id);
        abort_unless($data->canCancel ?? false, 422);

        DB::beginTransaction();
        try {
            $this->service->cancel($data);
            $data->logForCancelled();
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return back();
    }
}
