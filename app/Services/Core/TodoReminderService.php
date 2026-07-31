<?php

namespace App\Services\Core;

use App\Enums\TodoReminderStage;
use App\Models\Core\Todo;
use App\Models\Core\TodoReminder;
use App\Models\User\User;
use App\Notifications\TodoAutoClosedNotification;
use App\Notifications\TodoReminderNotification;
use App\Services\Core\Notification\NotifyUser;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Collection;

/**
 * Sweep harian yang mengirim reminder due_date ToDo (lead H-x, hari-H,
 * overdue eskalasi) dan menutup otomatis ToDo bertipe momen (event/meeting)
 * yang sudah lewat due_date. Dipanggil TodoRemindersDispatchCommand.
 */
class TodoReminderService {
    /**
     * @return array{scanned: int, sent: int, closed: int, skipped: int}
     */
    public function sweep(bool $dryRun = false, ?string $todoId = null): array {
        $tz     = config('app.schedule_timezone', 'Asia/Jakarta');
        $today  = CarbonImmutable::now($tz)->startOfDay();
        $result = ['scanned' => 0, 'sent' => 0, 'closed' => 0, 'skipped' => 0];

        Todo::query()
            ->dueForReminder()
            ->when($todoId, fn ($q) => $q->whereKey($todoId))
            ->with(['reminders', 'assignedBy', 'reference'])
            ->chunkById(100, function ($todos) use ($tz, $today, $dryRun, &$result) {
                $recipients = $this->resolveRecipients($todos);

                foreach ($todos as $todo) {
                    $result['scanned']++;

                    $dueDay = $todo->due_date->copy()->setTimezone($tz)->startOfDay();
                    $diff   = $today->diffInDays($dueDay, false);

                    if ($diff < 0 && $todo->type->autoClosesOnPass()) {
                        if (! $dryRun) {
                            $todo->update(['status' => 'closed']);
                            $this->notifyAutoClosed($todo, $recipients[$todo->id] ?? collect());
                        }
                        $result['closed']++;

                        continue;
                    }

                    $plan = $this->resolveStage($todo, $diff);
                    if ($plan === null) {
                        $result['skipped']++;

                        continue;
                    }

                    if ($this->dispatch($todo, $plan, $recipients[$todo->id] ?? collect(), $dryRun)) {
                        $result['sent']++;
                    } else {
                        $result['skipped']++;
                    }
                }
            });

        return $result;
    }

    /**
     * Resolusi stage murni (tanpa I/O selain relasi eager-loaded todo).
     *
     * @return array{stage: TodoReminderStage, offset_days: int}|null
     */
    public function resolveStage(Todo $todo, int $diff): ?array {
        if ($diff > 0) {
            if (in_array($diff, $todo->effectiveLeadDays(), true)) {
                return ['stage' => TodoReminderStage::LEAD, 'offset_days' => $diff];
            }

            return null;
        }

        if ($diff === 0) {
            return ['stage' => TodoReminderStage::DAY_OF, 'offset_days' => 0];
        }

        return $this->resolveOverdueStage($todo, abs($diff));
    }

    /**
     * @return array{stage: TodoReminderStage, offset_days: int}|null
     */
    private function resolveOverdueStage(Todo $todo, int $daysOverdue): ?array {
        if (! $todo->type->remindsOnOverdue()) {
            return null;
        }

        $schedule = $todo->type->overdueSchedule();

        $n = $todo->reminders
            ->where('stage', TodoReminderStage::OVERDUE)
            ->filter(fn (TodoReminder $reminder) => $reminder->due_date_snapshot->eq($todo->due_date))
            ->count();

        $dueOn = $n < $schedule['daily_count']
            ? $n + 1
            : $schedule['daily_count'] + ($n - $schedule['daily_count'] + 1) * $schedule['interval_days'];

        if ($daysOverdue < $dueOn) {
            return null;
        }

        return ['stage' => TodoReminderStage::OVERDUE, 'offset_days' => -($n + 1)];
    }

    /**
     * Resolusi massal assignee per chunk untuk menghindari N+1 —
     * allocatedUsers() bercabang pada allocated_to_type, tidak bisa
     * di-eager-load lewat relasi Eloquent biasa.
     *
     * @param  Collection<int, Todo>  $todos
     * @return array<string, Collection<int, User>>
     */
    private function resolveRecipients(Collection $todos): array {
        $userTodos = $todos->where('allocated_to_type', 'user');
        $roleTodos = $todos->where('allocated_to_type', 'role');

        $usersById = User::query()
            ->whereIn('id', $userTodos->pluck('allocated_to_id'))
            ->get()
            ->keyBy('id');

        // Satu query untuk seluruh anggota dari semua role dalam chunk ini,
        // lalu di-map per role id — bukan satu query per role-todo.
        $roleIds     = $roleTodos->pluck('allocated_to_id')->unique();
        $usersByRole = User::query()
            ->whereHas('roles', fn ($q) => $q->whereIn('roles.id', $roleIds))
            ->with(['roles' => fn ($q) => $q->whereIn('roles.id', $roleIds)])
            ->get()
            ->flatMap(fn (User $user) => $user->roles->map(fn ($role) => [$role->id, $user]))
            ->groupBy(fn ($pair) => $pair[0])
            ->map(fn ($pairs) => $pairs->map(fn ($pair) => $pair[1]));

        $recipients = [];

        foreach ($userTodos as $todo) {
            $user                  = $usersById->get($todo->allocated_to_id);
            $recipients[$todo->id] = $user ? collect([$user]) : collect();
        }

        foreach ($roleTodos as $todo) {
            $recipients[$todo->id] = $usersByRole->get($todo->allocated_to_id, collect());
        }

        return $recipients;
    }

    /**
     * Tulis ledger dulu, baru notifikasi — kalau notifikasi throw di
     * tengah jalan, baris ledger sudah ada dan run berikutnya tidak
     * membombardir ulang semua penerima. Unique constraint pada
     * (todo_id, stage, offset_days, due_date_snapshot) adalah primitif
     * idempotensi, bukan SELECT-lalu-INSERT yang rawan balapan.
     *
     * @param  array{stage: TodoReminderStage, offset_days: int}  $plan
     * @param  Collection<int, User>  $assignees
     */
    private function dispatch(Todo $todo, array $plan, Collection $assignees, bool $dryRun): bool {
        if ($dryRun) {
            return true;
        }

        try {
            $reminder = TodoReminder::create([
                'todo_id'           => $todo->id,
                'stage'             => $plan['stage'],
                'offset_days'       => $plan['offset_days'],
                'due_date_snapshot' => $todo->due_date,
                'sent_at'           => now(),
                'recipient_count'   => 0,
            ]);
        } catch (UniqueConstraintViolationException) {
            return false;
        }

        $targets = $assignees
            ->concat($todo->assignedBy ? [$todo->assignedBy] : [])
            ->unique('id');

        $notification = new TodoReminderNotification($todo, $plan['stage'], $plan['offset_days']);

        foreach ($targets as $user) {
            app(NotifyUser::class)->send($user, $notification);
        }

        $reminder->update(['recipient_count' => $targets->count()]);

        return true;
    }

    /**
     * @param  Collection<int, User>  $assignees
     */
    private function notifyAutoClosed(Todo $todo, Collection $assignees): void {
        $targets = $assignees
            ->concat($todo->assignedBy ? [$todo->assignedBy] : [])
            ->unique('id');

        $notification = new TodoAutoClosedNotification($todo);

        foreach ($targets as $user) {
            app(NotifyUser::class)->send($user, $notification);
        }
    }
}
