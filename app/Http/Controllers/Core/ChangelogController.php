<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\Changelog;
use App\Services\Core\ChangelogService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ChangelogController extends Controller {
    protected bool $ignorePermission = true;

    public function __construct(
        Request $request,
        private readonly ChangelogService $changelogService,
    ) {
        parent::__construct($request, Changelog::class);
    }

    public function index(Request $request): Response {
        $this->setBreadcrumbs();

        $user       = $request->user();
        $changelogs = Changelog::with('readers')->orderByDesc('deployed_at')->get();

        $this->changelogService->markAllRead($user);

        $changelogs = $changelogs->map(fn (Changelog $changelog) => [
            'id'           => $changelog->id,
            'version'      => $changelog->version,
            'environment'  => $changelog->environment,
            'content_html' => $changelog->content_html,
            'deployed_at'  => $changelog->deployed_at,
            'is_read'      => $changelog->isReadBy($user),
        ]);

        return Inertia::render('Core/Changelogs/Index', [
            'changelogs' => $changelogs,
        ]);
    }
}
