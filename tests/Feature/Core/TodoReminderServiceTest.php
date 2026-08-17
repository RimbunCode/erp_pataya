<?php

namespace Tests\Feature\Core;

use App\Enums\TodoReminderStage;
use App\Models\Core\FormatingSeries;
use App\Models\Core\Todo;
use App\Models\Core\TodoReminder;
use App\Models\User\Role;
use App\Models\User\User;
use App\Notifications\TodoAutoClosedNotification;
use App\Notifications\TodoReminderNotification;
use App\Services\Core\TodoReminderService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TodoReminderServiceTest extends TestCase {
    use RefreshDatabase;

    private TodoReminderService $service;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        FormatingSeries::create([
            'model'  => Todo::class,
            'name'   => 'ToDo',
            'format' => 'TODO/@[yy]-@[mm]/@[iiii]',
            'logs'   => ['imy' => []],
        ]);

        $this->service = app(TodoReminderService::class);
        // Titik acuan tetap: 2026-08-15 00:00 WIB, siang bolong (jauh dari
        // batas pergantian hari UTC) supaya konversi timezone tidak
        // memengaruhi hasil due_date yang di-set relatif terhadap ini.
        CarbonImmutable::setTestNow(CarbonImmutable::create(2026, 8, 15, 0, 0, 0, 'Asia/Jakarta'));
    }

    protected function tearDown(): void {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    // --- Resolusi stage ---

    public function test_lead_reminder_fires_on_configured_day(): void {
        Notification::fake();
        $todo = Todo::factory()->dueIn(7)->create(['reminder_lead_days' => [7, 3]]);

        $result = $this->service->sweep();

        $this->assertSame(1, $result['sent']);
        $this->assertDatabaseHas('todo_reminders', [
            'todo_id'     => $todo->id,
            'stage'       => TodoReminderStage::LEAD->value,
            'offset_days' => 7,
        ]);
    }

    public function test_h_minus_one_always_fires_even_when_not_configured(): void {
        Notification::fake();
        $todo = Todo::factory()->dueIn(1)->create(['reminder_lead_days' => [7, 3]]);

        $result = $this->service->sweep();

        $this->assertSame(1, $result['sent']);
        $this->assertDatabaseHas('todo_reminders', [
            'todo_id'     => $todo->id,
            'stage'       => TodoReminderStage::LEAD->value,
            'offset_days' => 1,
        ]);
    }

    public function test_no_reminder_on_unconfigured_lead_day(): void {
        Notification::fake();
        Todo::factory()->dueIn(5)->create(['reminder_lead_days' => [7, 3]]);

        $result = $this->service->sweep();

        $this->assertSame(0, $result['sent']);
        $this->assertSame(1, $result['skipped']);
    }

    public function test_day_of_always_fires(): void {
        Notification::fake();
        $todo = Todo::factory()->create(['due_date' => now(), 'reminder_lead_days' => null]);

        $result = $this->service->sweep();

        $this->assertSame(1, $result['sent']);
        $this->assertDatabaseHas('todo_reminders', [
            'todo_id'     => $todo->id,
            'stage'       => TodoReminderStage::DAY_OF->value,
            'offset_days' => 0,
        ]);
    }

    public function test_null_due_date_is_skipped_entirely(): void {
        Notification::fake();
        Todo::factory()->create(['due_date' => null]);

        $result = $this->service->sweep();

        $this->assertSame(0, $result['scanned']);
    }

    // --- Idempotensi ---

    public function test_sweep_is_idempotent_on_same_day_rerun(): void {
        Notification::fake();
        Todo::factory()->create(['due_date' => now()]);

        $this->service->sweep();
        $result = $this->service->sweep();

        $this->assertSame(0, $result['sent']);
        $this->assertSame(1, TodoReminder::count());
    }

    public function test_concurrent_insert_is_treated_as_already_sent(): void {
        Notification::fake();
        $todo = Todo::factory()->create(['due_date' => now()]);

        TodoReminder::create([
            'todo_id'           => $todo->id,
            'stage'             => TodoReminderStage::DAY_OF,
            'offset_days'       => 0,
            'due_date_snapshot' => $todo->due_date,
            'sent_at'           => now(),
        ]);

        $result = $this->service->sweep();

        $this->assertSame(0, $result['sent']);
        Notification::assertNothingSent();
    }

    // --- Batas eskalasi overdue ---

    public function test_task_overdue_escalates_daily_three_times_then_weekly(): void {
        Notification::fake();
        Todo::factory()->create(['due_date' => now(), 'type' => 'task']);

        $sentOnDay = [];
        for ($day = 1; $day <= 20; $day++) {
            CarbonImmutable::setTestNow(CarbonImmutable::create(2026, 8, 15, 0, 0, 0, 'Asia/Jakarta')->addDays($day));
            $result = $this->service->sweep();
            if ($result['sent'] > 0) {
                $sentOnDay[] = $day;
            }
        }

        $this->assertSame([1, 2, 3, 10, 17], $sentOnDay);
    }

    public function test_deadline_overdue_escalates_more_aggressively(): void {
        Notification::fake();
        Todo::factory()->create(['due_date' => now(), 'type' => 'deadline']);

        $sentOnDay = [];
        for ($day = 1; $day <= 14; $day++) {
            CarbonImmutable::setTestNow(CarbonImmutable::create(2026, 8, 15, 0, 0, 0, 'Asia/Jakarta')->addDays($day));
            $result = $this->service->sweep();
            if ($result['sent'] > 0) {
                $sentOnDay[] = $day;
            }
        }

        $this->assertSame([1, 2, 3, 4, 5, 6, 7, 10, 13], $sentOnDay);
    }

    public function test_overdue_stops_when_status_closed(): void {
        Notification::fake();
        $todo = Todo::factory()->create(['due_date' => now(), 'type' => 'task', 'status' => 'closed']);

        CarbonImmutable::setTestNow(CarbonImmutable::create(2026, 8, 15, 0, 0, 0, 'Asia/Jakarta')->addDays(1));
        $result = $this->service->sweep();

        $this->assertSame(0, $result['sent']);
        $this->assertSame(0, $result['scanned']);
    }

    public function test_overdue_catches_up_after_scheduler_outage(): void {
        Notification::fake();
        Todo::factory()->create(['due_date' => now(), 'type' => 'task']);

        // Scheduler "mati" hari 1-4, run pertama baru di hari 5.
        CarbonImmutable::setTestNow(CarbonImmutable::create(2026, 8, 15, 0, 0, 0, 'Asia/Jakarta')->addDays(5));
        $result = $this->service->sweep();

        $this->assertSame(1, $result['sent']);
    }

    // --- Auto-close ---

    public function test_event_is_auto_closed_when_due_date_passes(): void {
        Notification::fake();
        $todo = Todo::factory()->create(['due_date' => now()->subDay(), 'type' => 'event', 'status' => 'open']);

        $result = $this->service->sweep();

        $this->assertSame(1, $result['closed']);
        $this->assertSame(0, $result['sent']);
        $this->assertSame('closed', $todo->fresh()->status);
    }

    public function test_meeting_is_auto_closed_like_event(): void {
        Notification::fake();
        $todo = Todo::factory()->create(['due_date' => now()->subDay(), 'type' => 'meeting', 'status' => 'open']);

        $this->service->sweep();

        $this->assertSame('closed', $todo->fresh()->status);
    }

    public function test_task_is_not_auto_closed_and_does_remind_on_overdue(): void {
        Notification::fake();
        $todo = Todo::factory()->create(['due_date' => now()->subDay(), 'type' => 'task', 'status' => 'open']);

        $result = $this->service->sweep();

        $this->assertSame('open', $todo->fresh()->status);
        $this->assertSame(1, $result['sent']);
    }

    public function test_auto_closed_event_is_not_swept_again(): void {
        Notification::fake();
        $todo = Todo::factory()->create(['due_date' => now()->subDay(), 'type' => 'event', 'status' => 'open']);

        $this->service->sweep();
        $result = $this->service->sweep();

        $this->assertSame(0, $result['scanned']);
        $this->assertSame(0, $result['closed']);
    }

    public function test_auto_close_sends_todo_auto_closed_notification(): void {
        Notification::fake();
        $assignee = User::factory()->create();
        $todo     = Todo::factory()->create([
            'due_date'          => now()->subDay(),
            'type'              => 'event',
            'status'            => 'open',
            'allocated_to_id'   => $assignee->id,
            'allocated_to_type' => 'user',
        ]);

        $this->service->sweep();

        Notification::assertSentTo($assignee, TodoAutoClosedNotification::class);
    }

    public function test_dry_run_does_not_close_or_notify(): void {
        Notification::fake();
        $todo = Todo::factory()->create(['due_date' => now()->subDay(), 'type' => 'event', 'status' => 'open']);

        $result = $this->service->sweep(dryRun: true);

        $this->assertSame(1, $result['closed']);
        $this->assertSame('open', $todo->fresh()->status);
        Notification::assertNothingSent();
    }

    // --- Penerima ---

    public function test_reminder_goes_to_assignee_and_assigner(): void {
        Notification::fake();
        $assignee = User::factory()->create();
        $assigner = User::factory()->create();
        Todo::factory()->create([
            'due_date'          => now(),
            'allocated_to_id'   => $assignee->id,
            'allocated_to_type' => 'user',
            'assigned_by_id'    => $assigner->id,
        ]);

        $this->service->sweep();

        Notification::assertSentTo($assignee, TodoReminderNotification::class);
        Notification::assertSentTo($assigner, TodoReminderNotification::class);
    }

    /**
     * assignee === assigner harus tetap dianggap SATU penerima, dedup
     * unique('id') di dispatch(). Diverifikasi lewat recipient_count di
     * ledger — bukan assertSentToTimes, karena NotifyUser secara sengaja
     * memanggil Notification::sendNow() dua kali per notifiable (sekali
     * untuk channel database+broadcast sinkron, sekali lagi via
     * SendNotificationMailJob untuk channel mail) sehingga
     * Notification::fake() mencatat 2 "kali terkirim" walau cuma 1
     * penerima unik — pola yang sama juga berlaku di
     * TodoServiceTest::test_notify_assignee_*, yang karena itu memakai
     * assertSentTo (boolean) bukan assertSentToTimes.
     */
    public function test_self_assigned_todo_reminds_exactly_once(): void {
        Notification::fake();
        $user = User::factory()->create();
        Todo::factory()->create([
            'due_date'          => now(),
            'allocated_to_id'   => $user->id,
            'allocated_to_type' => 'user',
            'assigned_by_id'    => $user->id,
        ]);

        $this->service->sweep();

        Notification::assertSentTo($user, TodoReminderNotification::class);
        $this->assertSame(1, TodoReminder::first()->recipient_count);
    }

    public function test_role_assigned_reminder_fans_out_to_all_members_plus_assigner(): void {
        Notification::fake();
        $role     = Role::create(['name' => 'Warehouse Staff']);
        $member1  = User::factory()->create();
        $member2  = User::factory()->create();
        $assigner = User::factory()->create();
        $member1->roles()->attach($role->id);
        $member2->roles()->attach($role->id);

        Todo::factory()->create([
            'due_date'          => now(),
            'allocated_to_id'   => $role->id,
            'allocated_to_type' => 'role',
            'assigned_by_id'    => $assigner->id,
        ]);

        $this->service->sweep();

        Notification::assertSentTo($member1, TodoReminderNotification::class);
        Notification::assertSentTo($member2, TodoReminderNotification::class);
        Notification::assertSentTo($assigner, TodoReminderNotification::class);
    }

    public function test_null_assigned_by_does_not_break_dispatch(): void {
        Notification::fake();
        $assignee = User::factory()->create();
        Todo::factory()->create([
            'due_date'          => now(),
            'allocated_to_id'   => $assignee->id,
            'allocated_to_type' => 'user',
            'assigned_by_id'    => null,
        ]);

        $result = $this->service->sweep();

        $this->assertSame(1, $result['sent']);
        Notification::assertSentTo($assignee, TodoReminderNotification::class);
    }

    // --- Channel ---

    public function test_reminder_uses_database_broadcast_and_mail_channels(): void {
        Notification::fake();
        $assignee = User::factory()->create();
        Todo::factory()->create([
            'due_date'          => now(),
            'allocated_to_id'   => $assignee->id,
            'allocated_to_type' => 'user',
        ]);

        $this->service->sweep();

        Notification::assertSentTo($assignee, TodoReminderNotification::class, function ($notification) {
            return $notification->via($this) === ['database', 'broadcast', 'mail'];
        });
    }

    // --- Perubahan due_date (re-arm) ---

    public function test_reminder_rearms_after_due_date_changes(): void {
        Notification::fake();
        $todo = Todo::factory()->create(['due_date' => now()]);

        $this->service->sweep();
        $this->assertSame(1, TodoReminder::count());

        $todo->update(['due_date' => now()->addDays(30)]);
        CarbonImmutable::setTestNow(CarbonImmutable::create(2026, 8, 15, 0, 0, 0, 'Asia/Jakarta')->addDays(30));

        $result = $this->service->sweep();

        $this->assertSame(1, $result['sent']);
        $this->assertSame(2, TodoReminder::count());
    }

    // --- Performa (anti-N+1) ---

    /**
     * Bukti anti-N+1 murni pada resolveRecipients() — diukur TERPISAH dari
     * dispatch notifikasi (yang secara sah linear ~2-3 query/user via
     * NotifyUser, sehingga tidak bisa dipakai sebagai sinyal N+1 kalau
     * diukur lewat sweep() penuh). Dipanggil lewat reflection karena method
     * ini sengaja private (detail implementasi, bukan API publik service).
     */
    public function test_resolve_recipients_does_not_n_plus_one(): void {
        $role  = Role::create(['name' => 'Batch Test Role']);
        $todos = collect();
        for ($i = 0; $i < 15; $i++) {
            $user = User::factory()->create();
            $todos->push(Todo::factory()->make(['allocated_to_id' => $user->id, 'allocated_to_type' => 'user']));
        }
        for ($i = 0; $i < 15; $i++) {
            $todos->push(Todo::factory()->make(['allocated_to_id' => $role->id, 'allocated_to_type' => 'role']));
        }
        User::factory()->create()->roles()->attach($role->id);

        $method = new \ReflectionMethod(TodoReminderService::class, 'resolveRecipients');

        $queryCount = 0;
        DB::listen(function () use (&$queryCount) {
            $queryCount++;
        });

        $method->invoke($this->service, $todos);

        // 30 ToDo (15 user-langsung + 15 role) diselesaikan lewat tiga query
        // data batch (whereIn user, whereHas role, eager load roles) — bukan
        // satu query per ToDo. Anggaran (15) menoleransi overhead
        // schema-introspection SQLite (pragma_table_xinfo/sqlite_master saat
        // model User/Role pertama diakses) yang bisa menambah ~8 query
        // non-data di test environment, tapi tetap menangkap N+1 sungguhan
        // (yang akan menghasilkan ~30 query data, jauh di atas ambang ini).
        $this->assertLessThan(15, $queryCount, "resolveRecipients() memakai {$queryCount} query untuk 30 ToDo — indikasi N+1");
    }
}
