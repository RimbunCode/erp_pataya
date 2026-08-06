<?php

namespace App\Enums;

/**
 * Type of a ToDo. Each case carries its own reminder policy so the
 * scheduler never branches on type — adding a future type means adding
 * one case plus its arms in the methods below, nothing else.
 */
enum TodoType: string {
    case TASK     = 'task';
    case EVENT    = 'event';
    case MEETING  = 'meeting';
    case DEADLINE = 'deadline';

    public function label(): string {
        return __("core.todo.type.options.{$this->value}");
    }

    /** Apakah reminder lanjut setelah due_date lewat. */
    public function remindsOnOverdue(): bool {
        return match ($this) {
            self::TASK, self::DEADLINE => true,
            self::EVENT, self::MEETING => false,
        };
    }

    /**
     * @return array{daily_count: int, interval_days: int}|null
     *                                                          daily_count   — jumlah reminder harian berturut sebelum melebar
     *                                                          interval_days — jarak (hari) setelah daily_count habis
     */
    public function overdueSchedule(): ?array {
        return match ($this) {
            self::TASK     => ['daily_count' => 3, 'interval_days' => 7],
            self::DEADLINE => ['daily_count' => 7, 'interval_days' => 3],
            self::EVENT, self::MEETING => null,
        };
    }

    /** Apakah scheduler menutup ToDo saat due_date lewat. */
    public function autoClosesOnPass(): bool {
        return match ($this) {
            self::EVENT, self::MEETING => true,
            self::TASK, self::DEADLINE => false,
        };
    }

    /**
     * @return array<int, string>
     */
    public static function values(): array {
        return array_column(self::cases(), 'value');
    }
}
