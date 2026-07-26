<?php

namespace App\Http\Controllers\Helpdesk;

use App\Http\Controllers\Controller;
use App\Http\Requests\Helpdesk\TicketRequest;
use App\Http\Requests\Helpdesk\TicketResponseRequest;
use App\Models\Helpdesk\Ticket;
use App\Services\Core\BufferedAttachmentService;
use App\Services\Helpdesk\TicketService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class TicketController extends Controller {
    protected bool $ignorePermission = true;
    private TicketService $service;

    public function __construct(Request $request, TicketService $service) {
        $this->service = $service;
        parent::__construct($request, Ticket::class);
    }

    protected function enforcePermission(string $method): ?string {
        return match ($method) {
            'markDone', 'updateTicket' => 'write',
            default => null,
        };
    }

    public function index(Request $request) {
        if ($request->code) {
            $ticket = Ticket::where('code', $request->code)->firstOrFail();

            return redirect()->route('tickets.show', $ticket);
        }

        $this->setBreadcrumbs();
        Ticket::dataTable($request);

        return Inertia::render('Helpdesk/Tickets/Index');
    }

    public function create() {
        $this->setBreadcrumbs();

        return Inertia::render('Helpdesk/Tickets/Show');
    }

    public function store(TicketRequest $request) {
        $data              = $request->validated();
        $data['branch_id'] = $request->session()->get('currentBranch');
        DB::beginTransaction();
        $ticket = $this->service->create($data);
        DB::commit();

        return redirect()->route('tickets.show', $ticket)->with('id', $ticket->id);
    }

    public function show(Ticket $ticket) {
        $this->setBreadcrumbs($ticket);
        $ticket->showDetail();

        return Inertia::render('Helpdesk/Tickets/Show', [
            'ticket' => function () use ($ticket) {
                $ticket->loadRelations();

                return $ticket;
            },
        ]);
    }

    public function update(TicketRequest $request, Ticket $ticket) {
        DB::beginTransaction();
        $this->service->update($ticket, $request->validated());
        DB::commit();

        return back();
    }

    public function destroy(Ticket $ticket) {
        DB::beginTransaction();
        $ticket->delete();
        $ticket->logForDeleted();
        DB::commit();

        return redirect()->route('tickets.index');
    }

    public function markDone(Ticket $ticket) {
        DB::beginTransaction();
        $this->service->markDone($ticket);
        DB::commit();

        return redirect()->route('tickets.show', $ticket);
    }

    public function updateTicket(TicketResponseRequest $request, Ticket $ticket) {
        DB::beginTransaction();
        $this->service->updateTicket($ticket, $request->validated());
        BufferedAttachmentService::attach($ticket, $request);
        DB::commit();

        return redirect()->route('tickets.show', $ticket);
    }
}
