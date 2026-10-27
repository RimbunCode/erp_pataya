<?php

namespace App\Models\Core;

use App\Events\Core\AuditableModelSaved;
use App\Models\Model;
use App\Models\User\Permission;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Str;

// ponytail: no DataTable trait to avoid initPermissions schema drift on singleton tables.
// Permission entry is created manually in initPermissions(); audit wired here.
abstract class ModuleSetting extends Model {
    use HasUlids;

    protected $guarded = ['id', 'singleton'];

    /**
     * Snapshot before fillForUpdate(); filled by SettingsService.
     *
     * @var array<string,mixed>
     */
    public array $dataBefore = [];

    public static function current(): static {
        $existing = static::query()->first();

        if ($existing !== null) {
            return $existing;
        }

        try {
            // Auto-creation on first read is a system action, not a user edit:
            // it must not produce an audit entry (Requirement 10.3).
            return static::withoutEvents(fn (): static => static::create(['singleton' => true] + static::defaults()));
        } catch (UniqueConstraintViolationException) {
            return static::query()->firstOrFail();
        }
    }

    /** @return array<string,mixed> */
    abstract protected static function defaults(): array;

    /** @return array<string,mixed> */
    public static function defaultAttributes(): array {
        return static::defaults();
    }

    /** @return array<string,mixed> */
    abstract public static function rules(): array;

    /**
     * Columns validated by rules() but never writable through
     * SettingsService (system-maintained counters etc.).
     *
     * @return array<int, string>
     */
    public static function readonlyColumns(): array {
        return [];
    }

    /**
     * Columns whose values must never be written to the audit log in plain
     * text (credentials, bank account numbers, ...). They are recorded as
     * a redaction marker so the change itself stays traceable.
     *
     * @var array<int, string>
     */
    protected static array $auditRedacted = [];

    /** @param array<string, mixed> $values @return array<string, mixed> */
    protected static function auditSnapshot(array $values, array $keys): array {
        $snapshot = array_intersect_key($values, array_flip($keys));
        foreach (static::$auditRedacted as $redactedKey) {
            if (array_key_exists($redactedKey, $snapshot) && $snapshot[$redactedKey] !== null) {
                $snapshot[$redactedKey] = '[redacted]';
            }
        }

        return $snapshot;
    }

    /**
     * toArray() membuang atribut $hidden (mis. mail_password), padahal kolom
     * itu harus tetap tercatat sebagai penanda redaksi di audit.
     *
     * @return array<string, mixed>
     */
    protected function auditValues(): array {
        $values = $this->toArray();
        foreach (static::$auditRedacted as $redactedKey) {
            // Nilai mentah cukup (hanya dicek null/tidak): tidak perlu dekripsi,
            // sehingga ciphertext yang tak terbaca tidak menggagalkan update.
            $values[$redactedKey] = $this->getAttributes()[$redactedKey] ?? null;
        }

        return $values;
    }

    protected static function booted(): void {
        static::created(function ($model): void {
            if ($model instanceof Log) {
                return;
            }
            // Seeders, migrations and other unauthenticated system writes do
            // not flood the audit log (Requirement 10.3).
            if (! Auth::check()) {
                return;
            }
            $keys      = $model->logableFields();
            $dataAfter = static::auditSnapshot($model->auditValues(), $keys);
            event(new AuditableModelSaved($model, 'created', dataAfter: $dataAfter));
        });

        static::updated(function ($model): void {
            if ($model instanceof Log || empty($model->dataBefore)) {
                return;
            }
            if (! Auth::check()) {
                return;
            }
            $keys           = $model->logableFields();
            $dataAfter      = static::auditSnapshot($model->auditValues(), $keys);
            $beforeFiltered = static::auditSnapshot($model->dataBefore, $keys);
            // Nilai lama dan baru sama-sama tersamar; tandai bila berubah supaya
            // penggantian kredensial tetap terlacak tanpa membuka isinya.
            foreach (static::$auditRedacted as $redactedKey) {
                if (($beforeFiltered[$redactedKey] ?? null) !== null
                    && ($dataAfter[$redactedKey] ?? null) !== null
                    && $model->wasChanged($redactedKey)) {
                    $dataAfter[$redactedKey] = '[redacted:changed]';
                }
            }
            event(new AuditableModelSaved($model, 'updated', dataBefore: $beforeFiltered, dataAfter: $dataAfter));
        });
    }

    public function recordLogs(): void {
        $this->dataBefore = $this->auditValues();
    }

    public function fillForUpdate(array $attributes, bool $fillOnly = false): bool {
        $this->recordLogs();
        $this->fill($attributes);
        if ($fillOnly) {
            return true;
        }
        if ($this->isDirty()) {
            $this->fireModelEvent('saving', true);
            $this->fireModelEvent('updating', true);
        }

        return $this->save();
    }

    public function logableFields(): array {
        $except = ['id', 'created_at', 'updated_at'];

        return array_values(array_diff(array_keys($this->getAttributes()), $except));
    }

    /**
     * Non-aborting permission probe for read-only UI states (canWrite).
     * _checkPermission() stays the aborting variant used by Controller.
     */
    public static function hasPermission(array|string $action, int $level = 0): bool {
        $permissions      = Session::get('permissions');
        $modelPermissions = $permissions[static::class] ?? null;
        $levelPermissions = $modelPermissions[$level] ?? null;
        if (! \is_array($levelPermissions)) {
            return false;
        }
        foreach ($levelPermissions as $levelPermission) {
            $check = \is_array($action)
                ? \array_any($action, fn ($value) => $levelPermission['permissions'][$value] ?? false)
                : ($levelPermission['permissions'][$action] ?? false);
            if ($check) {
                return true;
            }
        }

        return false;
    }

    public static function _checkPermission(array|string $action, int $level = 0): bool {
        $permissions      = Session::get('permissions');
        $modelPermissions = $permissions[static::class] ?? null;
        $levelPermissions = $modelPermissions[$level] ?? null;
        if ($levelPermissions === null) {
            abort(403);
        }

        $allowed     = false;
        $onlyCreator = false;
        foreach ($levelPermissions as $levelPermission) {
            $check = \is_array($action)
                ? \array_any($action, fn ($value) => $levelPermission['permissions'][$value] ?? false)
                : ($levelPermission['permissions'][$action] ?? false);

            if ($levelPermission['only_creator'] && $check) {
                $allowed     = true;
                $onlyCreator = true;
            } elseif (! $levelPermission['only_creator'] && $check) {
                $allowed     = true;
                $onlyCreator = false;
            }
        }
        if (! $allowed) {
            abort(403);
        }

        return $onlyCreator;
    }

    // ponytail: duplicate of DataTable::_checkPermission shape; dedupe when settings use a shared permission helper.

    /**
     * Override the Permission.module for this setting model. Null means
     * "derive from namespace" (same as DataTable models). A dedicated value
     * keeps module-profile sweeps in AdministratorSeeder from implicitly
     * granting a setting page to non-admin roles (Requirement 9.4).
     */
    protected static ?string $permissionModule = null;

    public static function initPermissions(): void {
        $tableName = (new static)->getTable();
        if (! Schema::hasTable($tableName)) {
            return;
        }
        $nameModel = Str::afterLast(static::class, '\\');
        $alias     = Str::headline(Str::snake($nameModel));
        $trimmed   = str_replace('App\\Models\\', '', static::class);
        $parts     = explode('\\', $trimmed);
        array_pop($parts);
        $module = static::$permissionModule ?? (implode('\\', $parts) ?: null);
        if (! $module) {
            return;
        }
        Permission::withoutGlobalScope('exclude_example_data')->updateOrCreate(
            ['model' => static::class],
            [
                'module'             => $module,
                'name'               => Str::plural($alias),
                'route'              => Str::plural(Str::camel($nameModel)),
                'permissions'        => ['select', 'read', 'write'],
                'is_submitable'      => false,
                'allow_only_creator' => false,
                'ignore_permission'  => false,
            ],
        );
    }
}
