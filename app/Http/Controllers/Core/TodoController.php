<?php

namespace App\Http\Controllers\Core;

use App\Enums\Permission;
use App\Enums\TodoType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Core\TodoRequest;
use App\Models\Core\Todo;
use App\Services\Core\PermissionChecker;
use App\Services\Core\TodoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class TodoController extends Controller {
    public function __construct(Request $request, TodoService $service) {
        $this->service = $service;
        parent::__construct($request, Todo::class);
    }

    private function authorizeOwnTodoOrPermission(Todo $todo, Permission $action): void {
        $user = request()->user();

        $isOwn = $todo->allocatedUsers()->contains('id', $user->id)
            || $todo->assigned_by_id === $user->id;

        if ($isOwn) {
            return;
        }

        if (PermissionChecker::forUser(request())->can(Todo::class, $action)) {
            return;
        }

        abort(403);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();

        $query = PermissionChecker::forUser($request)->can(Todo::class, Permission::Select)
            ? Todo::query()
            : Todo::assignedToMe($request->user());

        $query->dataTable($request);

        return Inertia::render('Core/Todos/Index');
    }

    public function create(Request $request) {
        $this->setBreadcrumbs();

        return Inertia::render('Core/Todos/Show', [
            'defaultData' => [
                'allocated_to' => [
                    'id'   => $request->user()->id,
                    'type' => 'user',
                    'name' => $request->user()->name,
                ],
                'type'               => TodoType::TASK->value,
                'reminder_lead_days' => [],
            ],
        ]);
    }

    public function store(TodoRequest $request) {
        DB::beginTransaction();
        $todo = $this->service->create($request->validated());
        DB::commit();

        return redirect()->route('todos.show', $todo)->with('id', $todo->id);
    }

    public function show(Todo $todo) {
        $this->setBreadcrumbs($todo);
        $todo->showDetail();

        return Inertia::render('Core/Todos/Show', [
            'todo' => function () use ($todo) {
                $todo->loadRelations([], withTrashed: true);

                return $todo;
            },
            'referenceLabel' => $todo->reference?->code ?? $todo->reference?->name,
            'referenceRoute' => $todo->reference
                ? Str::plural($todo->reference->getNameClass()) . '.show'
                : null,
        ]);
    }

    public function update(TodoRequest $request, Todo $todo) {
        $this->authorizeOwnTodoOrPermission($todo, Permission::Write);

        DB::beginTransaction();
        try {
            $this->service->update($todo, $request->validated());
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }
        DB::commit();

        return back();
    }

    public function destroy(Todo $todo) {
        $this->authorizeOwnTodoOrPermission($todo, Permission::Delete);

        DB::beginTransaction();
        try {
            $todo->delete();
            $todo->logForDeleted();
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return redirect()->route('todos.index');
    }
}
