<?php

namespace App\Models\Core\DefaultRules;

use App\Events\Core\AuditableModelSaved;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Facades\Auth;

abstract class AuditableDefaultRule extends Model {
    use HasFactory, HasUlids;

    protected $guarded = ['id'];

    /** @var array<string, mixed> */
    public array $dataBefore = [];

    protected function casts(): array {
        return ['is_stock_item' => 'boolean', 'priority' => 'integer'];
    }

    protected static function booted(): void {
        static::created(function (self $model): void {
            if (Auth::check()) {
                event(new AuditableModelSaved($model, 'created', dataAfter: $model->auditData()));
            }
        });

        static::updated(function (self $model): void {
            if (Auth::check() && $model->dataBefore !== []) {
                $dataBefore = $model->dataBefore;
                $dataAfter  = $model->auditData();
                event(new AuditableModelSaved($model, 'updated', $dataBefore, $dataAfter));
            }
        });

        static::deleted(function (self $model): void {
            if (Auth::check()) {
                $dataBefore = $model->auditData();
                event(new AuditableModelSaved($model, 'deleted', dataBefore: $dataBefore));
            }
        });
    }

    /** @return array<string, mixed> */
    public function auditData(): array {
        return $this->only(array_diff(array_keys($this->getAttributes()), ['created_at', 'updated_at']));
    }

    public function recordLogs(): void {
        $this->dataBefore = $this->auditData();
    }
}
