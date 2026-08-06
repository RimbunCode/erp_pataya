<?php

namespace App\Traits;

use App\Casts\FormStatusesCast;
use App\Casts\Json;
use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Events\Core\AuditableModelSaved;
use App\Events\Core\DocumentCanceled;
use App\Events\Core\DocumentStatusChanged;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Finances\GeneralLedger;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Model;
use App\Models\User\User;
use App\Services\Core\Approval\ApprovalService;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

trait Submitable {
    use DataTable, HasBranch;

    protected static bool $is_submitable = true;

    /**
     * Role-based document notification config: status value (string) =>
     * daftar nama role yang dinotifikasi saat dokumen transisi ke status
     * itu. Kosong secara default — model submitable override method ini
     * kalau perlu notifikasi role-based (mis. Warehouse dinotifikasi saat
     * SalesOrder disubmit). Method (bukan property) dipakai karena PHP
     * tidak mengizinkan override langsung static property trait di class
     * yang memakainya (fatal error "definition differs").
     *
     * @return array<string, array<int, string>>
     */
    protected static function notifyRolesOnStatus(): array {
        return [];
    }

    public function initializeSubmitable() {
        $this->mergeCasts([
            'status'          => FormStatusesCast::class,
            'additional_data' => Json::class,
            'submitted_at'    => 'datetime',
            'canceled_at'     => 'datetime',
            'amended_from_id' => 'string',
        ]);
        $this->with = [
            ...$this->with ?? [],
            'createdBy',
        ];
    }

    public static function bootSubmitable() {
        self::creating(function ($model) {
            if (! ($model->isSubmitable() ?? false)) {
                return;
            }
            if ($model->status == null) {
                $model->status = FormStatus::DRAFT;
            }
            if ($model->created_by_id == null) {
                $model->created_by_id = Auth::id();
            }
        });
        self::saving(function ($model) {
            if (! ($model->isSubmitable() ?? false)) {
                return;
            }

            if ($model->status == null) {
                $model->status = FormStatus::DRAFT;
            }

            static $submittedFormatColumnCache = [];
            $tableName                         = $model->getTable();
            $hasSubmittedFormatColumn          = $submittedFormatColumnCache[$tableName] ??= Schema::hasColumn($tableName, 'submitted_format');
            if ($hasSubmittedFormatColumn && $model->isDirty('code')) {
                $latestFormat = FormatingSeries::where('model', $model::class)->value('format');
                if (is_string($latestFormat) && trim($latestFormat) !== '') {
                    $model->submitted_format = $latestFormat;
                }
            }

            if (! \in_array(FormStatus::DRAFT, $model->status)) {
                $model->submitted_at = now();
            }
            if (\in_array(FormStatus::CANCELED, $model->status) && $model->isDirty('status')) {
                $model->canceled_at = now();
                GeneralLedger::where('referenceable_type', get_class($model))->where('referenceable_id', $model->id)->update([
                    'deleted_at' => now(),
                ]);
                StockLedgerEntry::where('referenceable_type', get_class($model))->where('referenceable_id', $model->id)->update([
                    'deleted_at' => now(),
                ]);
            }
        });

        // Cascade update status step ke CANCELED + notifikasi ApprovalCanceledNotification
        // ke approver kandidat ditangani lewat event DocumentCanceled + listener
        // CancelPendingApprovalSteps (ShouldQueue). Dispatch di sini, setelah save()
        // sukses — supaya tidak terkirim untuk save yang gagal.
        self::saved(function ($model) {
            if (! ($model->isSubmitable() ?? false) || ! $model->wasChanged('status')) {
                return;
            }
            if (! \in_array(FormStatus::CANCELED, $model->status)) {
                return;
            }

            $approval = $model->approvalable;
            if (! $approval) {
                return;
            }

            event(new DocumentCanceled($model, $approval));
        });

        // Role-based document notification: model submitable meng-override
        // notifyRolesOnStatus() untuk menentukan role mana yang dinotifikasi
        // saat dokumen transisi ke status tertentu. Notifikasi dikirim lewat
        // event DocumentStatusChanged + listener NotifyRoleOnStatusChange (ShouldQueue).
        self::saved(function ($model) {
            if (! ($model->isSubmitable() ?? false) || ! $model->wasChanged('status')) {
                return;
            }

            $config = static::notifyRolesOnStatus();
            $roles  = [];
            foreach ($model->status as $statusValue) {
                $roles = [...$roles, ...($config[$statusValue->value] ?? [])];
            }
            $roles = array_unique($roles);

            if ($roles === []) {
                return;
            }

            event(new DocumentStatusChanged($model, $roles));
        });
    }

    public function createdBy() {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function branch() {
        return $this->belongsTo(Branch::class);
    }

    public function approvalable() {
        return $this->morphOne(ApprovalInstance::class, 'document', 'document_type', 'document_id');
    }

    protected function getCanCancelAttribute(): bool {
        $condition = ! \in_array(FormStatus::DRAFT, (array) $this->status)
            && ! \in_array(FormStatus::CANCELED, (array) $this->status);
        if (! \method_exists(static::class, 'canCancel')) {
            return $condition;
        }

        return $condition && $this->canCancel();
    }

    public function amendedFrom() {
        return $this->belongsTo(\get_class($this), 'amended_from_id');
    }

    public function checkApproval(array $options = [], string $triggerOn = 'submit') {
        if (! \property_exists(static::class, 'service')) {
            throw new \LogicException(
                static::class . ' harus mendeklarasikan property $service untuk memakai checkApproval().',
            );
        }

        if (! \is_subclass_of(static::$service, SubmitableService::class)) {
            throw new \LogicException(
                static::$service . ' harus implement ' . SubmitableService::class . '.',
            );
        }

        return DB::transaction(function () use ($options, $triggerOn) {
            $result = app(ApprovalService::class)->check($this, static::$service, $options, $triggerOn);
            event(new AuditableModelSaved($this, 'submitted'));
            DB::commit();

            return $result;
        });
    }

    public function amend($withRelations = true) {
        DB::beginTransaction();
        $this->loadAllRelations(HasMany::class, MorphMany::class);
        if ($this->amended_from_id == null) {
            $this->increment('revision_number');
            $newCode       = $this->code . "-{$this->revision_number}";
            $amendedFromId = $this->id;
        } else {
            $dataOri = $this->amendedFrom;
            $dataOri->increment('revision_number');
            $newCode       = $dataOri->code . "-{$dataOri->revision_number}";
            $amendedFromId = $dataOri->id;
        }
        $newData = $this->replicate([
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'canceled_at',
            'submitted_at',
            'status',
            'revision_number',
            'created_by_id',
            'code',
            'submitted_format',
        ]);
        $newData->code            = $newCode;
        $newData->amended_from_id = $amendedFromId;

        if ($withRelations) {
            $newData->push();
            foreach ($this->getRelations() as $key => $value) {
                if ($value instanceof Collection) {
                    $foreignKey = $newData->$key()->getForeignKeyName();
                    foreach ($value as $item) {
                        $item = $item->replicate([
                            'id',
                            'created_at',
                            'updated_at',
                            'deleted_at',
                            ...$item->getGuarded(),
                            $foreignKey,
                        ]);
                        $item->$foreignKey = $newData->id;
                        $item->save();
                    }

                }
            }
        } else {
            $newData->save();
        }

        event(new AuditableModelSaved($this, 'amended'));
        // logForCreated() untuk $newData sekarang ditangani lewat hook
        // static::created() di DataTable::bootDataTable().
        DB::commit();

        return $newData;
    }

    public function attachConnections(Model $item, ?array $data, ?int $depth = null) {
        if ($depth !== null && $depth < 0) {
            return;
        }
        if ($item && ($item->referenceable_type == null || $item->referenceable_id == null)) {
            return;
        }

        $sourceItem = $item->referenceable;

        ModelConnection::createConnection([
            'model'     => $sourceItem,
            'reference' => $item,
            'data'      => $data,
        ]);

        $parentRelation = $sourceItem->parentRelation;
        if ($parentRelation) {
            ModelConnection::createConnection([
                'model'     => $parentRelation,
                'reference' => $this,
            ]);
        }
        $nextDepth = $depth === null ? null : $depth - 1;
        $this->attachConnections($sourceItem, $data, $nextDepth);
    }
}
