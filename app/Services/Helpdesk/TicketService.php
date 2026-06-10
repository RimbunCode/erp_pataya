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
        $data['start_date']    = $data['start_date'] ?? now();

        $ticket = Ticket::create($data);
        $ticket->logForCreated();

        return $ticket;
    }

    public function update(Ticket $ticket, array $data): Ticket {
        $data['assign_to_id'] = $data['assign_to']['id'] ?? null;

        $ticket->update($data);
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
            'status'       => 'done',
            'progress'     => 100,
            'end_date'     => now(),
        ]);

        $ticket->logForUpdated();

        return $ticket;
    }

    public function updateTicket(Ticket $ticket, array $data): TicketResponse {
        $assignToId = $data['assign_to']['id'] ?? null;

        $ticket->update([
            'assign_to_id' => $assignToId,
            'status'       => $data['status'],
            'progress'     => $data['progress'],
        ]);

        $response = TicketResponse::create([
            'ticket_id'    => $ticket->id,
            'user_id'      => Auth::id(),
            'assign_to_id' => $assignToId,
            'status'       => $data['status'],
            'progress'     => $data['progress'],
            'content'      => $data['content'] ?? null,
            'end_date'     => $data['end_date'] ?? null,
        ]);

        $ticket->logForUpdated();

        return $response;
    }
}
