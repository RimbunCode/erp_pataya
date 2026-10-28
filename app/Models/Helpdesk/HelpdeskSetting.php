<?php

namespace App\Models\Helpdesk;

use App\Models\Core\ModuleSetting;
use Database\Factories\Helpdesk\HelpdeskSettingFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Validation\Rule;

class HelpdeskSetting extends ModuleSetting {
    /** @use HasFactory<HelpdeskSettingFactory> */
    use HasFactory;

    /**
     * Sama dengan `in:` pada TicketRequest dan TicketResponseRequest (tidak ada enum).
     *
     * @var list<string>
     */
    public const TICKET_TYPES = ['bug_problem', 'task', 'question', 'other'];

    /** @var list<string> */
    public const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical'];

    public string $translateKey = 'helpdesk.setting';

    // Modul Permission khusus agar profil peran tidak membuka halaman ini bagi non-admin.
    protected static ?string $permissionModule = 'Setting';

    protected function casts(): array {
        return [
            'singleton'        => 'boolean',
            'default_due_days' => 'integer',
        ];
    }

    protected static function defaults(): array {
        return [
            'default_type'     => null,
            'default_priority' => null,
            'default_due_days' => null,
        ];
    }

    public static function rules(): array {
        return [
            'default_type'     => ['nullable', 'string', Rule::in(self::TICKET_TYPES)],
            'default_priority' => ['nullable', 'string', Rule::in(self::TICKET_PRIORITIES)],
            'default_due_days' => ['nullable', 'integer', 'min:0', 'max:65535'],
        ];
    }
}
