<?php

namespace App\Http\Controllers\Finances;

use App\Http\Controllers\Controller;
use App\Models\Finances\PaymentSchedule;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PaymentScheduleController extends Controller
{
    public function __construct(Request $request)
    {
        parent::__construct($request, PaymentSchedule::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $this->setBreadcrumbs();
        // tampilkan hanya paymentShedule yang sudah di submit
        PaymentSchedule::dataTable($request);

        return Inertia::render(
            'Finances/PaymentSchedules/Index',
            []
        );
    }

    /**
     * Display the specified resource.
     */
    public function show(PaymentSchedule $paymentSchedule)
    {
        $this->setBreadcrumbs($paymentSchedule);
        $paymentSchedule->showDetail();

        return Inertia::render('Finances/PaymentSchedules/Show', [
            'paymentSchedule' => function () use ($paymentSchedule) {
                $paymentSchedule->loadRelations();

                return $paymentSchedule;
            },
        ]);
    }
}
