<?php

namespace App\Services\Report;

use App\Models\Helpdesk\Ticket;
use App\Models\User\Role;
use App\Notifications\ReportIssueNotification;
use App\Services\Helpdesk\TicketService;
use Illuminate\Support\Facades\Notification;
use RuntimeException;

/**
 * Mengubah laporan masalah dari pengguna menjadi Ticket bertugas ke role tim IT,
 * lalu mengirim notifikasi ke anggota role itu.
 */
final class ReportIssueReporter {
    public function __construct(private TicketService $tickets) {}

    /**
     * @param  array<string, string>  $filterSummary
     */
    public function report(
        string $reportName,
        array $filterSummary,
        int $kpiRows,
        int $tableRows,
        string $url,
    ): Ticket {
        $role = $this->issueRole();

        $ticket = $this->tickets->create([
            'type'      => 'bug_problem',
            'priority'  => 'high',
            'status'    => 'new',
            'progress'  => 0,
            'subject'   => __('report.issue.subject', ['report' => $reportName]),
            'assign_to' => ['id' => $role->id, 'type' => 'role'],
        ]);

        // Ticket tidak punya kolom deskripsi; isi laporan disimpan di respons awal.
        // `content` dirender sebagai HTML (Tickets/Show.jsx), sedangkan reportName,
        // filterSummary, dan url seluruhnya berasal dari request klien — escape tiap
        // nilai supaya markup yang diselipkan tersimpan sebagai teks, bukan markup.
        $ticket->responses()->update([
            'content' => __('report.issue.description', [
                'filter'     => e($this->formatFilter($filterSummary)),
                'kpi_rows'   => $kpiRows,
                'table_rows' => $tableRows,
                'url'        => e($url),
            ]),
        ]);

        Notification::send($ticket->assignedUsers(), new ReportIssueNotification($ticket, $reportName));

        return $ticket;
    }

    private function issueRole(): Role {
        $name = (string) config('report.issue_role');
        $role = Role::where('name', $name)->first();

        if ($role === null) {
            throw new RuntimeException("Role tim IT untuk laporan masalah tidak ditemukan: '{$name}' (config report.issue_role).");
        }

        return $role;
    }

    /**
     * @param  array<string, string>  $filterSummary
     */
    private function formatFilter(array $filterSummary): string {
        if ($filterSummary === []) {
            return __('report.issue.no_filter');
        }

        $parts = [];
        foreach ($filterSummary as $label => $value) {
            $parts[] = "{$label}: {$value}";
        }

        return implode('; ', $parts);
    }
}
