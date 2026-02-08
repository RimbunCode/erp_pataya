<?php

namespace App\Http\Controllers\Finances;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\PaymentEntryRequest;
use App\Models\Core\Preference;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentSchedule;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Sales\SalesOrder;
use App\Models\Core\FormatingSeries;
use App\Services\Finances\PaymentEntryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PaymentEntryController extends Controller {
  private PaymentEntryService $service;

  public function __construct(Request $request, PaymentEntryService $service) {
    $this->referenceCodeService = $preferenceCodeService;
    $this->service              = $service;
    parent::__construct($request, PaymentEntry::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    PaymentEntry::dataTable($request);

    return Inertia::render(
      'Finances/PaymentEntries/Index',
      [],
    );
  }

  /**
   * Show the form for creating a new resource.
   */
  public function create(Request $request, string $ref = null) {
    if ($ref) {
      $select   = $request->has('select') ? $request->select : null;
      $split    = \explode("/", $ref);
      $modelOri = $split[0] ?? null;
      $id       = $split[1] ?? null;
      if ($modelOri) {
        $model = match ($modelOri) {
          'paymentSchedule' => PaymentSchedule::class,
          default           => null,
        };
        if ($modelOri == 'paymentSchedule' && $id) {
          $paymentSchedule = PaymentSchedule::find($id);

          $modelReference = $paymentSchedule->payment_scheduleable_type;

          if ($modelReference == SalesOrder::class) {
            $partyable = $paymentSchedule->referenceTo->customer;
            $currency  = $paymentSchedule->referenceTo->currency;
          }
        } else {
          $modelReference = $model;
        }
      }
      $payment_type = match ($modelReference) {
        SalesOrder::class    => 'receive',
        PurchaseOrder::class => 'pay',
      };
    }

    $this->setBreadcrumbs('finance.paymentEntry.new');
    return Inertia::render('Finances/PaymentEntries/Show', [
      'paymentable_type' => $model,
      'paymentable_id'   => $id,
      'payment_type'     => $payment_type,
      "partyable_type"   =>
        $payment_type === "receive"
        ? "App\\Models\\Sales\\Customer"
        : ($payment_type === "pay"
          ? "App\\Models\\Purchase\\Supplier"
          : null),
      'partyable'        => $partyable ?? null,
      'currency'         => $currency ?? null,
      'paid_amount'      => $paymentSchedule?->outstanding_amount ?? null,
      'payment_method'   => $paymentSchedule?->paymentMethod ?? null
    ]);
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(PaymentEntryRequest $request) {
    $data              = $request->validated();
    $data['branch_id'] = $request->session()->get('currentBranch');
    $code              = FormatingSeries::get(PaymentEntry::class, $data);
    $data['code']      = $code;
    $paymentEntry      = $this->service->create($data);
    return redirect()->route('paymentEntries.show', $paymentEntry);
  }

  /**
   * Display the specified resource.
   */
  public function show(PaymentEntry $paymentEntry) {
    $this->setBreadcrumbs($paymentEntry);
    $paymentEntry->showDetail();

    return Inertia::render('Finances/PaymentEntries/Show', [
      'paymentEntry' => function () use ($paymentEntry) {
        $paymentEntry->loadRelations();
        return $paymentEntry;
      },
    ]);
  }

  /**
   * Show the form for editing the specified resource.
   */

  /**
   * Update the specified resource in storage.
   */
  public function update(PaymentEntryRequest $request, PaymentEntry $paymentEntry) {
    $data         = $request->validated();
    $paymentEntry = $this->service->update($paymentEntry, $data);
    return redirect()->route('paymentEntries.show', $paymentEntry);
  }

  // Opsional: log internal order submit
  public function submit(PaymentEntry $paymentEntry) {
    DB::beginTransaction();

    try {
      $paymentEntry->load('paymentable');

      if ($paymentEntry->status === FormStatus::SUBMITTED) {
        return back()->with('error', 'Payment Entry sudah disubmit sebelumnya.');
      }

      $paymentEntry->update([
        'status' => FormStatus::SUBMITTED,
      ]);

      // Kalau payment_entry ini terhubung ke PaymentSchedule
      if ($paymentEntry->paymentable_type === PaymentSchedule::class) {
        /** @var PaymentSchedule $paymentSchedule */
        $paymentSchedule = $paymentEntry->paymentable;

        // Validasi overpayment
        $totalPaid = $paymentSchedule->paid_amount + $paymentEntry->paid_amount;
        if ($totalPaid > $paymentSchedule->payment_amount) {
          DB::rollBack();
          return back()->with('error', 'Jumlah pembayaran melebihi total yang harus dibayar.');
        }

        // Update jumlah paid & tanggal pembayaran
        $paymentSchedule->update([
          'paid_amount'      => $totalPaid,
          'base_paid_amount' => $paymentSchedule->base_paid_amount + $paymentEntry->based_paid_amount,
          'payment_date'     => now(),
          'submitted_at'     => now(),
        ]);
      }

      // Log aktivitas
      $paymentEntry->logForSubmitted();

      DB::commit();

      return redirect()
        ->route('paymentEntries.show', $paymentEntry)
        ->with('success', 'Payment Entry berhasil disubmit.');
    } catch (\Throwable $th) {
      DB::rollBack();
      report($th);
      return back()->with('error', 'Terjadi kesalahan saat submit Payment Entry.');
    }
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(string $id) {
    //
  }
}
