<?php

namespace App\Services\Helpdesk;

use App\Models\Core\FormatingSeries;
use App\Models\Helpdesk\Tiket;
use App\Models\Helpdesk\TiketResponse;
use Illuminate\Support\Facades\Auth;

class TiketService {
    public function create(array $data): Tiket {
        $data['code']          = FormatingSeries::generate(Tiket::class, $data);
        $data['created_by_id'] = Auth::id();
        $data['assign_to_id']  = $data['assign_to']['id'] ?? null;
        $data['start_date']    = $data['start_date'] ?? now();

        $tiket = Tiket::create($data);
        $tiket->logForCreated();

        return $tiket;
    }

    public function update(Tiket $tiket, array $data): Tiket {
        $data['assign_to_id'] = $data['assign_to']['id'] ?? null;

        $tiket->update($data);
        $tiket->logForUpdated();

        return $tiket;
    }

    public function markDone(Tiket $tiket): Tiket {
        $tiket->update([
            'status'   => 'done',
            'progress' => 100,
            'end_date' => now(),
        ]);

        TiketResponse::create([
            'tiket_id'     => $tiket->id,
            'user_id'      => Auth::id(),
            'assign_to_id' => $tiket->assign_to_id,
            'status'       => 'done',
            'progress'     => 100,
            'end_date'     => now(),
        ]);

        $tiket->logForUpdated();

        return $tiket;
    }

    public function updateTiket(Tiket $tiket, array $data): TiketResponse {
        $assignToId = $data['assign_to']['id'] ?? null;

        $tiket->update([
            'assign_to_id' => $assignToId,
            'status'       => $data['status'],
            'progress'     => $data['progress'],
        ]);

        $response = TiketResponse::create([
            'tiket_id'     => $tiket->id,
            'user_id'      => Auth::id(),
            'assign_to_id' => $assignToId,
            'status'       => $data['status'],
            'progress'     => $data['progress'],
            'content'      => $data['content'] ?? null,
            'end_date'     => $data['end_date'] ?? null,
        ]);

        $tiket->logForUpdated();

        return $response;
    }
}
