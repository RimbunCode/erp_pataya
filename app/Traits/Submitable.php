<?php

namespace App\Traits;

use App\Casts\FormStatusesCast;
use App\FormStatus;
use App\Http\Controllers\Core\ApprovalInstanceController;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\Branch;
use App\Models\Finances\GeneralLedger;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\User\User;
use Illuminate\Support\Facades\Auth;

trait Submitable {
  use DataTable;
  protected static bool $is_submitable = true;

  public function initializeSubmitable() {
    $this->mergeCasts([
      'status'       => FormStatusesCast::class,
      'submitted_at' => 'datetime',
    ]);
    $this->with = [
      ...$this->with ?? [],
      "createdBy",
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
        GeneralLedger::where("referenceable_type", get_class($model))->where("referenceable_id", $model->id)->update([
          'deleted_at' => now(),
        ]);
        StockLedgerEntry::where("referenceable_type", get_class($model))->where("referenceable_id", $model->id)->update([
          'deleted_at' => now(),
        ]);
        if (\method_exists($model, 'onCancel')) {
          $model->onCancel();
        }
      }
    });
  }

  /**
   * Summary of replaceStatus
   * @param FormStatus|array<FormStatus> $from
   * @param FormStatus|array<FormStatus> $to
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

  public function checkApproval(array $options = []) {
    return app()->call(\join([ApprovalInstanceController::class, '@', 'checkApproval']), [
      'data'    => $this,
      'options' => $options,
    ]);
  }
}
