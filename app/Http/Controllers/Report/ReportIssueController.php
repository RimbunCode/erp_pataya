<?php

namespace App\Http\Controllers\Report;

use App\Http\Controllers\Controller;
use App\Services\Report\ReportCatalog;
use App\Services\Report\ReportIssueReporter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Endpoint tombol "Laporkan masalah ini" pada banner ketidakcocokan KPI.
 * Dapat dipakai semua pengguna yang melihat laporan.
 */
class ReportIssueController extends Controller {
    public function store(Request $request, ReportIssueReporter $reporter, ReportCatalog $catalog): RedirectResponse|JsonResponse {
        // Judul laporan dan label filter dibatasi ke himpunan yang memang dikenal
        // aplikasi: deskripsi Ticket dibaca tim IT sebagai keterangan resmi, jadi
        // pelapor tidak boleh mengarang nama laporan atau label filter di dalamnya.
        $reportTitles = array_map(fn ($definition) => $definition->title, $catalog->all());
        $filterLabels = array_values(__('report.filter'));

        $validated = $request->validate([
            'report'     => ['required', 'string', Rule::in($reportTitles)],
            'kpi_rows'   => ['required', 'integer', 'min:0'],
            'table_rows' => ['required', 'integer', 'min:0'],
            'filter'     => ['nullable', 'array:' . implode(',', $filterLabels)],
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
