<?php

namespace App\Services\Core;

use App\Models\Core\FormatingSeries;
use App\Models\Core\Todo;
use App\Notifications\TodoAssignedNotification;
use App\Services\Core\Notification\NotifyUser;
use Illuminate\Validation\ValidationException;
use LogicException;

class TodoService {
    public function create(array $data): Todo {
        $data                   = $this->normalize($data, fillMissingAssignee: true);
        $data['assigned_by_id'] = auth()->id();
        $data['code']           = static::generateCode($data);

        $todo = Todo::create($data);

        $this->notifyAssignee($todo);

        return $todo;
    }

    /**
     * Satu-satunya jalur insert Todo untuk referensi dokumen (sidebar
     * "Assigned To" dan buffered-assignee saat create dokumen). Menyatukan
     * jalur yang sebelumnya duplikat insert langsung di
     * Controller::addAssignee dan BufferedAttachmentService::attachAssignees.
     *
     * Status DIPAKSA 'open' secara eksplisit — jalur referensi dokumen tidak
     * boleh menentukan status sendiri (AssigneeRequest tidak punya rule
     * status; payload buffered_assignees yang menyelundupkan status lain
     * harus tetap menghasilkan ToDo open, bukan jatuh ke default DB).
     *
     * Tidak ada cek already_assigned — constraint unik
     * todos_reference_assignee_unique yang jadi dasarnya sudah dilonggarkan
     * (lihat migrasi 2026_07_31_000003) karena event/meeting berulang butuh
     * assignee-sama-dokumen-sama lebih dari sekali.
     */
    public function createForReference(array $data): Todo {
        $data['status'] = 'open';

        return $this->create($data);
    }

    public static function generateCode(array $data): string {
        return FormatingSeries::generate(Todo::class, $data);
    }

    /**
     * Mengosongkan allocated_to saat edit mereassign ToDo ke editor, tapi
     * tidak boleh terjadi diam-diam. Tanpa confirm_reassign, request dengan
     * allocated_to kosong DAN assignee saat ini bukan editor ditolak
     * eksplisit — frontend menampilkan dialog konfirmasi lalu resubmit
     * dengan confirm_reassign: true untuk melanjutkan. Kalau assignee saat
     * ini SUDAH editor sendiri, konfirmasi dilewati (tidak ada perubahan
     * berarti).
     */
    public function update(Todo $todo, array $data): Todo {
        $blankAssignee          = ! filled($data['allocated_to']['id'] ?? null);
        $currentlyOwnedByEditor = $todo->allocated_to_id === auth()->id();

        if ($blankAssignee && ! $currentlyOwnedByEditor && ! ($data['confirm_reassign'] ?? false)) {
            throw ValidationException::withMessages([
                'allocated_to' => [__('core.todo.confirm.reassign_to_self')],
            ]);
        }

        // fillMissingAssignee=true di sini konsisten dengan create(): setelah
        // guard konfirmasi di atas lolos, blank allocated_to MEMANG berarti
        // "reassign ke diri sendiri" — bukan lagi kasus yang harus ditolak.
        $data          = $this->normalize($data, fillMissingAssignee: true);
        $wasReassigned = $todo->allocated_to_id !== $data['allocated_to_id'];

        $todo->update($data);

        if ($wasReassigned) {
            $this->notifyAssignee($todo);
        }

        return $todo;
    }

    public function notifyAssignee(Todo $todo): void {
        foreach ($todo->allocatedUsers() as $user) {
            if ($user->id === $todo->assigned_by_id) {
                continue;
            }

            app(NotifyUser::class)->send($user, new TodoAssignedNotification($todo));
        }
    }

    /**
     * Menormalkan allocated_to menjadi allocated_to_id + allocated_to_type.
     *
     * Ketika allocated_to.id kosong dan $fillMissingAssignee true, seluruh
     * objek allocated_to diperlakukan sebagai absen (bukan hanya id-nya
     * saja) dan fallback ke auth()->id() + type 'user'. Ini mencegah
     * kombinasi id-kosong/type-terisi (atau sebaliknya) menyisakan setengah
     * data lama — seluruh assignee diresolusi ulang sebagai satu unit.
     */
    private function normalize(array $data, bool $fillMissingAssignee): array {
        $allocatedTo = $data['allocated_to'] ?? null;
        $hasAssignee = filled($allocatedTo['id'] ?? null);

        if ($hasAssignee) {
            $data['allocated_to_id']   = $allocatedTo['id'];
            $data['allocated_to_type'] = $allocatedTo['type'] ?? 'user';
        } elseif ($fillMissingAssignee) {
            if (auth()->id() === null) {
                throw new LogicException('Cannot default ToDo assignee to self outside an authenticated context.');
            }

            $data['allocated_to_id']   = auth()->id();
            $data['allocated_to_type'] = 'user';
        } else {
            $data['allocated_to_id']   = null;
            $data['allocated_to_type'] = null;
        }

        unset($data['allocated_to']);

        return $data;
    }
}
