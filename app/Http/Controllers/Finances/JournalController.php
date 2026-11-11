<?php

namespace App\Http\Controllers\Finances;

use App\Exceptions\Finances\ClosedPeriodException;
use App\Exceptions\Finances\DuplicatePostingException;
use App\Exceptions\Finances\InvalidJournalException;
use App\Exceptions\Finances\JournalAlreadyReversedException;
use App\Exceptions\Finances\UnbalancedJournalException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\JournalReverseRequest;
use App\Models\Core\Currency;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Services\Finances\Ledger\FiscalPeriodService;
use App\Services\Finances\Ledger\JournalReversalService;
use App\Services\Finances\Ledger\MinorUnit;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Daftar, detail, dan aksi Balik jurnal (Finance Fase 1, Requirement 11.1-11.2, 14.1). Jurnal hanya dibuat oleh
 * `JournalService`; controller ini tidak menerima atribut jurnal dari request (hanya tanggal dan alasan reversal).
 */
class JournalController extends Controller {
    private const DEFAULT_MINOR_UNIT = 2;

    public function __construct(Request $request) {
        parent::__construct($request, Journal::class);
    }

    protected function enforcePermission(string $method) {
        return $method === 'reverse' ? 'reverse' : parent::enforcePermission($method);
    }

    public function index(Request $request): Response {
        $this->setBreadcrumbs();
        Journal::dataTable($request);

        return Inertia::render('Finances/Journals/Index');
    }

    public function show(Journal $journal, JournalReversalService $reversals): Response {
        $this->setBreadcrumbs($journal);
        $journal->showDetail();

        $minorUnit = $this->minorUnit($journal);
        $lines     = $this->lines($journal);

        return Inertia::render('Finances/Journals/Show', [
            'journal' => function () use ($journal) {
                $journal->loadRelations([], withTrashed: true);

                return $journal;
            },
            'lines'      => $lines->map(fn (GeneralLedger $line) => $this->linePayload($line))->all(),
            'totals'     => $this->totals($lines, $minorUnit),
            'minorUnit'  => $minorUnit,
            'canReverse' => $this->hasPermission('reverse') && $reversals->canReverse($journal),
        ]);
    }

    public function reverse(JournalReverseRequest $request, Journal $journal, JournalReversalService $reversals, FiscalPeriodService $periods): RedirectResponse {
        $data = $request->validated();

        try {
            $reversal = $reversals->reverse(
                $journal,
                $this->reversalDate($data['date'] ?? null, $periods->companyTimezone()),
                $data['reason'] ?? null,
            );
        } catch (ClosedPeriodException $e) {
            throw ValidationException::withMessages(['date' => $e->getMessage()]);
        } catch (JournalAlreadyReversedException|InvalidJournalException|UnbalancedJournalException|DuplicatePostingException $e) {
            throw ValidationException::withMessages(['reverse' => $e->getMessage()]);
        }

        return redirect()->route('journals.show', $reversal)->with('success', __('finances/journal.reverse.success', ['code' => $reversal->code]));
    }

    /**
     * Hari yang dipilih pengguna dibaca dalam zona waktu perusahaan (Requirement 6.9). Hari ini memakai waktu
     * sekarang agar urutan jurnal terjaga; hari lain memakai awal hari zona perusahaan.
     */
    private function reversalDate(?string $date, string $timezone): CarbonImmutable {
        if ($date === null) {
            return CarbonImmutable::now();
        }

        $day = CarbonImmutable::createFromFormat('Y-m-d', $date, $timezone)->startOfDay();

        return $day->isSameDay(CarbonImmutable::now($timezone)) ? CarbonImmutable::now() : $day;
    }

    /**
     * @return Collection<int, GeneralLedger>
     */
    private function lines(Journal $journal): Collection {
        return $journal->lines()
            ->withTrashed()
            ->with([
                'account'        => fn ($query) => $query->withTrashed(),
                'againstAccount' => fn ($query) => $query->withTrashed(),
            ])
            ->get();
    }

    /**
     * @return array<string, mixed>
     */
    private function linePayload(GeneralLedger $line): array {
        return [
            'id'              => $line->id,
            'line_no'         => $line->line_no,
            'description'     => $line->description,
            'debit'           => $line->debit,
            'credit'          => $line->credit,
            'deleted_at'      => $line->deleted_at,
            'account'         => $this->accountPayload($line->account),
            'against_account' => $this->accountPayload($line->againstAccount),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function accountPayload(mixed $account): ?array {
        if ($account === null) {
            return null;
        }

        return [
            'id'             => $account->id,
            'account_number' => $account->account_number,
            'account_name'   => $account->account_name,
            'deleted_at'     => $account->deleted_at,
        ];
    }

    /**
     * Total dan keseimbangan dihitung di server dalam minor unit mata uang dasar jurnal (bukan dari penjumlahan
     * float di JS), memakai baris aktif; jurnal `voided` (seluruh baris soft-deleted) memakai seluruh baris.
     *
     * @param  Collection<int, GeneralLedger>  $lines
     * @return array{debit: string, credit: string, balanced: bool, active_lines: int}
     */
    private function totals(Collection $lines, int $minorUnit): array {
        $active = $lines->filter(fn (GeneralLedger $line) => $line->deleted_at === null);
        $source = $active->isEmpty() ? $lines : $active;

        $debit  = $source->sum(fn (GeneralLedger $line) => MinorUnit::toMinor($line->debit, $minorUnit));
        $credit = $source->sum(fn (GeneralLedger $line) => MinorUnit::toMinor($line->credit, $minorUnit));

        return [
            'debit'        => MinorUnit::fromMinor($debit, $minorUnit),
            'credit'       => MinorUnit::fromMinor($credit, $minorUnit),
            'balanced'     => $debit === $credit,
            'active_lines' => $active->count(),
        ];
    }

    private function minorUnit(Journal $journal): int {
        if ($journal->currency_code === null) {
            return self::DEFAULT_MINOR_UNIT;
        }

        $minorUnit = Currency::query()->withoutGlobalScopes()->whereKey($journal->currency_code)->value('minor_unit');

        return $minorUnit === null ? self::DEFAULT_MINOR_UNIT : (int) $minorUnit;
    }

    private function hasPermission(string $action): bool {
        try {
            Journal::_checkPermission($action);
        } catch (HttpException) {
            return false;
        }

        return true;
    }
}
