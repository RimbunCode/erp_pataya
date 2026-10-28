<?php

namespace Database\Factories\Helpdesk;

use App\Models\Helpdesk\HelpdeskSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<HelpdeskSetting>
 */
class HelpdeskSettingFactory extends Factory {
    protected $model = HelpdeskSetting::class;

    public function definition(): array {
        return [
            'singleton'        => true,
            'default_type'     => null,
            'default_priority' => null,
            'default_due_days' => null,
        ];
    }
}
