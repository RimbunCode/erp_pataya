<?php

namespace Tests\Feature\Core;

use App\Enums\TodoType;
use Tests\TestCase;

/**
 * Mengunci matriks kebijakan type ToDo (design.md §1) — perubahan di sini
 * harus disengaja, bukan efek samping.
 */
class TodoTypeTest extends TestCase {
    public function test_remind_on_overdue_matrix(): void {
        $this->assertTrue(TodoType::TASK->remindsOnOverdue());
        $this->assertTrue(TodoType::DEADLINE->remindsOnOverdue());
        $this->assertFalse(TodoType::EVENT->remindsOnOverdue());
        $this->assertFalse(TodoType::MEETING->remindsOnOverdue());
    }

    public function test_auto_closes_on_pass_matrix(): void {
        $this->assertFalse(TodoType::TASK->autoClosesOnPass());
        $this->assertFalse(TodoType::DEADLINE->autoClosesOnPass());
        $this->assertTrue(TodoType::EVENT->autoClosesOnPass());
        $this->assertTrue(TodoType::MEETING->autoClosesOnPass());
    }

    public function test_overdue_schedule_matrix(): void {
        $this->assertSame(['daily_count' => 3, 'interval_days' => 7], TodoType::TASK->overdueSchedule());
        $this->assertSame(['daily_count' => 7, 'interval_days' => 3], TodoType::DEADLINE->overdueSchedule());
        $this->assertNull(TodoType::EVENT->overdueSchedule());
        $this->assertNull(TodoType::MEETING->overdueSchedule());
    }

    public function test_values_returns_all_four_string_values(): void {
        $this->assertSame(['task', 'event', 'meeting', 'deadline'], TodoType::values());
    }
}
