<?php

namespace App\Enums;

enum TodoReminderStage: string {
    case LEAD    = 'lead';     // H-x, x dari reminder_lead_days ∪ {1}
    case DAY_OF  = 'day_of';   // H-0
    case OVERDUE = 'overdue';  // setelah due_date lewat

    public function label(): string {
        return __("core.todo.reminder_stage.options.{$this->value}");
    }
}
