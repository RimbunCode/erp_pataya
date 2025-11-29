<?php

namespace App\Http\Controllers\Core;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\ApprovalInstanceStep;
use App\Models\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

class ApprovalInstanceController extends Controller {
  public function __construct(Request $request) {
    parent::__construct($request, ApprovalInstance::class);
  }

  public function checkApproval(Model $data, array $options = []) {
    dd($data);

    return DB::transaction(function () use ($data, $options) {

      $currentRoute     = Route::getCurrentRoute();
      $controller       = $currentRoute->getControllerClass();
      $parameters       = $currentRoute->originalParameters();
      $instanceApproval = ApprovalInstance::makeInstance($data, [
        'controller' => $controller,
        'parameters' => $parameters,
        'options'    => $options,
      ]);

      if (! $instanceApproval || $instanceApproval->status == FormStatus::APPROVED) {
        $result = app()->call(\join([$controller, '@', 'onApproved'], [
          ...$parameters,
        ]));
      } else if ($instanceApproval->status == FormStatus::REJECTED) {
        $result = app()->call(\join([$controller, '@', 'onRejected'], [
          ...$parameters,
        ]));
      } else {
        $data->update([
          'status' => FormStatus::PENDING,
        ]);
      }

      $data->logForSubmitted();

      return $result ?? null;
    });

  }

  public function approve(ApprovalInstanceStep $approvalInstanceStep) {
    DB::beginTransaction();
    $approval = $approvalInstanceStep->approvalInstance;

    $approvalInstanceStep->update([
      'status' => FormStatus::APPROVED,
    ]);

    $isApproved = false;
    foreach ($approval->steps as $step) {
      $isApproved = match ($step->status) {
        FormStatus::PENDING, FormStatus::SKIPPED => false,
        FormStatus::APPROVED                     => true,
      };
    }

    if ($isApproved) {
      $approval->update([
        'status' => FormStatus::APPROVED,
      ]);
      DB::commit();
      return app()->call(\join([$approval->controller, '@', 'onApproved'], [
        ...$approval->parameters,
      ]));
    }
    DB::commit();
    return back();
  }

  public function reject(ApprovalInstanceStep $approvalInstanceStep) {
    DB::beginTransaction();
    $approval = $approvalInstanceStep->approvalInstance;

    $approvalInstanceStep->update([
      'status' => FormStatus::REJECTED,
    ]);

    $isRejected = false;
    foreach ($approval->steps as $step) {
      if ($isRejected) {
        $step->update([
          'status' => FormStatus::SKIPPED,
        ]);
      }
      if ($step->status == FormStatus::REJECTED) {
        $isRejected = true;
      }
    }

    if ($isRejected) {
      $approval->update([
        'status' => FormStatus::REJECTED,
      ]);
      DB::commit();
      return app()->call(\join([$approval->controller, '@', 'onRejected'], [
        ...$approval->parameters,
      ]));
    }
    DB::commit();
    return back();
  }
}
