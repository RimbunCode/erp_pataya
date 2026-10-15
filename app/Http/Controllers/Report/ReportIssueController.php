<?php

namespace App\Http\Controllers\Report;

use App\Http\Controllers\Controller;
use App\Services\Report\ReportIssueReporter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Endpoint tombol "Laporkan masalah ini" pada banner ketidakcocokan KPI.
 * Dapat dipakai semua pengguna yang melihat laporan.
 */
class ReportIssueController extends Controller {
    public function store(Request $request, ReportIssueReporter $reporter): RedirectResponse|JsonResponse {
        $validated = $request->validate([
            'report'     => ['required', 'string', 'max:255'],
            'kpi_rows'   => ['required', 'integer', 'min:0'],
            'table_rows' => ['required', 'integer', 'min:0'],
            'filter'     => ['nullable', 'array'],
            'filter.*'   => ['string', 'max:500'],
            // Dibatasi ke URL http(s) supaya skema seperti javascript: tidak pernah
            // tersimpan di deskripsi Ticket yang nanti ditampilkan sebagai tautan.
            'url' => ['required', 'string', 'max:2048', 'url', 'starts_with:http://,https://'],
        ]);

        $ticket = $reporter->report(
            reportName: $validated['report'],
            filterSummary: $validated['filter'] ?? [],
            kpiRows: (int) $validated['kpi_rows'],
            tableRows: (int) $validated['table_rows'],
            url: $validated['url'],
        );

        if ($request->expectsJson()) {
            return response()->json(['ticketCode' => $ticket->code], 201);
        }

        return back()->with('reportIssueTicket', $ticket->code);
    }
}
