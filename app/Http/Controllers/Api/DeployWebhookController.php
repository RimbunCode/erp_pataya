<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Helpdesk\Ticket;
use App\Services\Core\ChangelogService;
use App\Services\Helpdesk\TicketService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeployWebhookController extends Controller {
    public function __construct(
        private readonly ChangelogService $changelogService,
        private readonly TicketService $ticketService,
    ) {}

    public function __invoke(Request $request): JsonResponse {
        if ($request->bearerToken() !== config('services.deploy.webhook_token')) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $validated = $request->validate([
            'tickets'     => ['nullable', 'array', 'max:50'],
            'tickets.*'   => ['string'],
            'environment' => ['required', 'string'],
            'version'     => ['required', 'string'],
            'changelog'   => ['required', 'string'],
        ]);

        $changelog = $this->changelogService->store(
            $validated['version'],
            $validated['environment'],
            $validated['changelog'],
        );

        $resolved        = [];
        $notFound        = [];
        $alreadyResolved = [];

        foreach ($validated['tickets'] ?? [] as $code) {
            $ticket = Ticket::where('code', $code)->first();

            if (! $ticket) {
                $notFound[] = $code;

                continue;
            }

            $wasAlreadyResolved = $this->ticketService->resolveFromDeploy($ticket, $validated['version']);

            if ($wasAlreadyResolved) {
                $alreadyResolved[] = $code;
            } else {
                $resolved[] = $code;
            }
        }

        return response()->json([
            'resolved'         => $resolved,
            'not_found'        => $notFound,
            'already_resolved' => $alreadyResolved,
            'changelog_id'     => $changelog->id,
        ]);
    }
}
