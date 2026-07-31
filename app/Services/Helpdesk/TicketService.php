<?php

namespace App\Services\Helpdesk;

use App\Models\Core\FormatingSeries;
use App\Models\Helpdesk\Ticket;
use App\Models\Helpdesk\TicketResponse;
use Illuminate\Support\Facades\Auth;

class TicketService {
    /**
     * Pasangan assign_to_id + assign_to_type dari payload form ({id, type}).
     * Dipusatkan di sini agar tidak ada alur yang lupa menulis type saat id di-set.
     *
     * @return array{assign_to_id: ?string, assign_to_type: ?string}
     */
    private function assigneeAttributes(array $data): array {
        return [
            'assign_to_id'   => $data['assign_to']['id'] ?? null,
            'assign_to_type' => $data['assign_to']['type'] ?? null,
        ];
    }

    public function create(array $data): Ticket {
        $data['code']          = FormatingSeries::generate(Ticket::class, $data);
        $data['created_by_id'] = Auth::id();
        $data                  = [...$data, ...$this->assigneeAttributes($data)];
        $data['start_date'] ??= now();

        if (($data['status'] ?? null) === 'done' && ($data['progress'] ?? 0) < 100) {
            $data['progress'] = 100;
        }

        $ticket = Ticket::create($data);

        TicketResponse::create([
            'ticket_id'      => $ticket->id,
            'user_id'        => Auth::id(),
            'assign_to_id'   => $ticket->assign_to_id,
            'assign_to_type' => $ticket->assign_to_type,
            'type'           => $ticket->type,
            'priority'       => $ticket->priority,
            'subject'        => $ticket->subject,
            'status'         => $ticket->status,
            'progress'       => $ticket->progress,
            'start_date'     => $ticket->start_date,
            'due_date'       => $ticket->due_date,
            'content'        => null,
            'content_json'   => null,
        ]);

        $ticket->logForCreated();

        return $ticket;
    }

    public function update(Ticket $ticket, array $data): Ticket {
        $data = [...$data, ...$this->assigneeAttributes($data)];

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
            'ticket_id'      => $ticket->id,
            'user_id'        => Auth::id(),
            'assign_to_id'   => $ticket->assign_to_id,
            'assign_to_type' => $ticket->assign_to_type,
            'type'           => $ticket->type,
            'priority'       => $ticket->priority,
            'subject'        => $ticket->subject,
            'status'         => 'done',
            'progress'       => 100,
            'start_date'     => $ticket->start_date,
            'due_date'       => $ticket->due_date,
            'end_date'       => now(),
        ]);

        $ticket->logForUpdated();

        return $ticket;
    }

    public function resolveFromDeploy(Ticket $ticket, string $version): bool {
        $alreadySettled = in_array($ticket->status->value, ['resolved', 'done']);

        if (! $alreadySettled) {
            $ticket->update([
                'status'         => 'resolved',
                'progress'       => 90,
                'end_date'       => now(),
                'assign_to_id'   => $ticket->created_by_id,
                'assign_to_type' => 'user',
            ]);
        }

        TicketResponse::create([
            'ticket_id'      => $ticket->id,
            'user_id'        => null,
            'assign_to_id'   => $ticket->created_by_id,
            'assign_to_type' => 'user',
            'type'           => $ticket->type,
            'priority'       => $ticket->priority,
            'subject'        => $ticket->subject,
            'status'         => 'resolved',
            'progress'       => 90,
            'start_date'     => $ticket->start_date,
            'due_date'       => $ticket->due_date,
            'end_date'       => now(),
            'content'        => "Diselesaikan pada deploy {$version}.",
            'content_json'   => null,
        ]);

        $ticket->logForUpdated();

        return $alreadySettled;
    }

    public function updateTicket(Ticket $ticket, array $data): TicketResponse {
        $assignee = $this->assigneeAttributes($data);

        if (($data['status'] ?? null) === 'done' && ($data['progress'] ?? 0) < 100) {
            $data['progress'] = 100;
        }

        $ticket->update([
            ...$assignee,
            'type'       => $data['type'],
            'priority'   => $data['priority'],
            'subject'    => $data['subject'],
            'status'     => $data['status'],
            'progress'   => $data['progress'],
            'start_date' => $data['start_date'],
            'due_date'   => $data['due_date'] ?? null,
        ]);

        $response = TicketResponse::create([
            'ticket_id' => $ticket->id,
            'user_id'   => Auth::id(),
            ...$assignee,
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
