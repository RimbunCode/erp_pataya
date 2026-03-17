<?php

namespace App\Traits;

use App\Casts\FormStatusesCast;
use App\Casts\Json;
use App\FormStatus;
use App\Http\Controllers\Core\ApprovalInstanceController;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\Branch;
use App\Models\Finances\GeneralLedger;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

trait Submitable {
    use DataTable;

    protected static bool $is_submitable = true;

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
            if ($model->created_by == null) {
                $model->created_by = Auth::id();
            }
        });
        self::saving(function ($model) {
            if (! ($model->isSubmitable() ?? false)) {
                return;
            }

            if ($model->status == null) {
                $model->status = FormStatus::DRAFT;
            }

            if (! \in_array(FormStatus::DRAFT, $model->status)) {
                $model->submitted_at = now();
            }
            if (\in_array(FormStatus::CANCELED, $model->status)) {
                $model->canceled_at = now();
                GeneralLedger::where('referenceable_type', get_class($model))->where('referenceable_id', $model->id)->update([
                    'deleted_at' => now(),
                ]);
                StockLedgerEntry::where('referenceable_type', get_class($model))->where('referenceable_id', $model->id)->update([
                    'deleted_at' => now(),
                ]);
            }
        });
    }

    /**
     * Summary of replaceStatus
     *
     * @param  FormStatus|array<FormStatus>  $from
     * @param  FormStatus|array<FormStatus>  $to
     * @return FormStatus|array<FormStatus>
     */
    public function replaceStatus($from, $to) {
        return \array_replace($this->status, $from, $to);
    }

    public function createdBy() {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function branch() {
        return $this->belongsTo(Branch::class);
    }

    public function approvalable() {
        return $this->morphOne(ApprovalInstance::class, 'document', 'document_type', 'document_id');
    }

    public function amendedFrom() {
        return $this->belongsTo(\get_class($this), 'amended_from_id');
    }

    public function checkApproval(array $options = []) {
        return app()->call(\implode([ApprovalInstanceController::class, '@', 'checkApproval']), [
            'data'    => $this,
            'options' => $options,
        ]);
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
            'created_by',
            'code',
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

        $this->logForAmended();
        $newData->logForCreated();
        DB::commit();

        return $newData;
    }
}
