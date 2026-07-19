<?php

namespace App\Services\Core;

use App\Models\Core\Todo;
use App\Notifications\TodoAssignedNotification;
use App\Services\Core\Notification\NotifyUser;

class TodoService {
    public function create(array $data): Todo {
        $data                   = $this->normalize($data);
        $data['assigned_by_id'] = auth()->id();

        $todo = Todo::create($data);

        $this->notifyAssignee($todo);

        return $todo;
    }

    public function update(Todo $todo, array $data): Todo {
        $data          = $this->normalize($data);
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

    private function normalize(array $data): array {
        $data['allocated_to_id']   = $data['allocated_to']['id'] ?? null;
        $data['allocated_to_type'] = $data['allocated_to']['type'] ?? null;
        unset($data['allocated_to']);

        return $data;
    }
}
