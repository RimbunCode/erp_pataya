<?php

namespace App\Services\Helpdesk;

use App\Models\Core\FormatingSeries;
use App\Models\Helpdesk\Ticket;
use App\Models\Helpdesk\TicketResponse;
use Illuminate\Support\Facades\Auth;

class TicketService {
    public function create(array $data): Ticket {
        $data['code']          = FormatingSeries::generate(Ticket::class, $data);
        $data['created_by_id'] = Auth::id();
        $data['assign_to_id']  = $data['assign_to']['id'] ?? null;
        $data['start_date'] ??= now();

        if (($data['status'] ?? null) === 'done' && ($data['progress'] ?? 0) < 100) {
            $data['progress'] = 100;
        }

        $ticket = Ticket::create($data);

        TicketResponse::create([
            'ticket_id'    => $ticket->id,
            'user_id'      => Auth::id(),
            'assign_to_id' => $ticket->assign_to_id,
            'type'         => $ticket->type,
            'priority'     => $ticket->priority,
            'subject'      => $ticket->subject,
            'status'       => $ticket->status,
            'progress'     => $ticket->progress,
            'start_date'   => $ticket->start_date,
            'due_date'     => $ticket->due_date,
            'content'      => null,
            'content_json' => null,
        ]);

        $ticket->logForCreated();

        return $ticket;
    }

    public function update(Ticket $ticket, array $data): Ticket {
        $data['assign_to_id'] = $data['assign_to']['id'] ?? null;

        $ticket->fillForUpdate($data);
        $ticket->logForUpdated();

        return $ticket;
    }

    public function markDone(Ticket $ticket): Ticket {
        $ticket->update([
            'status'   => 'done',
            'progress' => 100,
            'end_date' => now(),
        ]);

        TicketResponse::create([
            'ticket_id'    => $ticket->id,
            'user_id'      => Auth::id(),
            'assign_to_id' => $ticket->assign_to_id,
            'type'         => $ticket->type,
            'priority'     => $ticket->priority,
            'subject'      => $ticket->subject,
            'status'       => 'done',
            'progress'     => 100,
            'start_date'   => $ticket->start_date,
            'due_date'     => $ticket->due_date,
            'end_date'     => now(),
        ]);

        $ticket->logForUpdated();

        return $ticket;
    }

    public function resolveFromDeploy(Ticket $ticket, string $version): bool {
        $alreadySettled = in_array($ticket->status->value, ['resolved', 'done']);

        if (! $alreadySettled) {
            $ticket->update([
                'status'       => 'resolved',
                'progress'     => 90,
                'end_date'     => now(),
                'assign_to_id' => $ticket->created_by_id,
            ]);
        }

        TicketResponse::create([
            'ticket_id'    => $ticket->id,
            'user_id'      => null,
            'assign_to_id' => $ticket->created_by_id,
            'type'         => $ticket->type,
            'priority'     => $ticket->priority,
            'subject'      => $ticket->subject,
            'status'       => 'resolved',
            'progress'     => 90,
            'start_date'   => $ticket->start_date,
            'due_date'     => $ticket->due_date,
            'end_date'     => now(),
            'content'      => "Diselesaikan pada deploy {$version}.",
            'content_json' => null,
        ]);

        $ticket->logForUpdated();

        return $alreadySettled;
    }

    public function updateTicket(Ticket $ticket, array $data): TicketResponse {
        $assignToId = $data['assign_to']['id'] ?? null;

        if (($data['status'] ?? null) === 'done' && ($data['progress'] ?? 0) < 100) {
            $data['progress'] = 100;
        }

        $ticket->update([
            'assign_to_id' => $assignToId,
            'type'         => $data['type'],
            'priority'     => $data['priority'],
            'subject'      => $data['subject'],
            'status'       => $data['status'],
            'progress'     => $data['progress'],
            'start_date'   => $data['start_date'],
            'due_date'     => $data['due_date'] ?? null,
        ]);

        $response = TicketResponse::create([
            'ticket_id'    => $ticket->id,
            'user_id'      => Auth::id(),
            'assign_to_id' => $assignToId,
            'type'         => $data['type'],
            'priority'     => $data['priority'],
            'subject'      => $data['subject'],
            'status'       => $data['status'],
            'progress'     => $data['progress'],
            'start_date'   => $data['start_date'],
            'due_date'     => $data['due_date'] ?? null,
            'content'      => $data['content'] ?? null,
            'content_json' => $data['content_json'] ?? null,
        ]);

        $ticket->logForUpdated();

        return $response;
    }
}
