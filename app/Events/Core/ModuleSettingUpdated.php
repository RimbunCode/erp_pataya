<?php

namespace App\Events\Core;

use App\Models\Core\ModuleSetting;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ModuleSettingUpdated implements ShouldDispatchAfterCommit {
    use Dispatchable, SerializesModels;

    public function __construct(
        public ModuleSetting $setting,
        public array $attributes = [],
    ) {
        foreach ($setting->getHidden() as $attribute) {
            if (array_key_exists($attribute, $this->attributes)) {
                $this->attributes[$attribute] = '[redacted]';
            }
        }
    }
}
