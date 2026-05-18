<?php

namespace Tests\Feature;

use Illuminate\Console\Scheduling\Schedule;
use Tests\TestCase;

class CommandSearchScheduleTest extends TestCase {
    public function test_commands_index_rebuild_is_scheduled_daily_with_without_overlapping(): void {
        $schedule = app(Schedule::class);
        $event    = collect($schedule->events())
            ->first(fn ($item) => str_contains((string) $item->command, 'commands:index --rebuild'));

        $this->assertNotNull($event);
        $this->assertSame('20 1 * * *', $event->expression);
        $this->assertTrue((bool) $event->withoutOverlapping);
    }
}
