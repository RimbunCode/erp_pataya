import { router, usePage } from "@inertiajs/react";
import { useMemo, useState } from "react";
import MainLayout from "@/Layouts/MainLayout";
import { formatRp, STATUS_CFG } from "@/lib/utils";
import PeriodFilterChart from "@/Components/Charts/PeriodFilterChart";

const EARNING_CONFIG = {
  amount: { label: "Pendapatan Bersih", color: "var(--primary)" },
};

const fmtDateTime = (isoString) => {
  if (!isoString) {
    return "-";
  }

  const date = new Date(isoString);
  return `${date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} ${date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const fmtPercent = (value) => {
  return `${Number(value ?? 0).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
};

const PAYOUT_STATUS_CFG = {
  draft: {
    label: "Draft",
    pill: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  },
  pending: {
    label: "Pending",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  approved: {
    label: "Approved",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  rejected: {
    label: "Rejected",
    pill: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
  paid: {
    label: "Paid",
    pill: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
};

function PayoutStatusBadge({ status }) {
  const cfg = PAYOUT_STATUS_CFG[status] ?? PAYOUT_STATUS_CFG.pending;

  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${cfg.pill}`}>
      {cfg.label}
    </span>
  );
}

function MutationStatusPill({ status }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
        STATUS_CFG[status]?.pill ??
        "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300"
      }`}
    >
      {STATUS_CFG[status]?.label}
    </span>
  );
}

function RequestPayoutModal({
  onClose,
  onSubmit,
  canSubmit,
  requestAmount,
  setRequestAmount,
  requestNote,
  setRequestNote,
  submitting,
  availableBalance,
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-xl p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-sm font-black text-foreground uppercase tracking-widest">
              Request Payout
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Available balance:{" "}
              <span className="font-semibold text-foreground">
                {formatRp(availableBalance)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            X
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <input
            type="number"
            min={0}
            placeholder="Amount"
            value={requestAmount}
            onChange={(event) => setRequestAmount(event.target.value)}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background"
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={requestNote}
            onChange={(event) => setRequestNote(event.target.value)}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background"
          />
        </div>

        {!canSubmit && requestAmount !== "" && (
          <p className="text-xs text-red-600 mt-2">
            Amount must be greater than 0 and not exceed available balance.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest uppercase border border-border text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || submitting}
            className="px-4 py-2 rounded-xl text-xs font-extrabold tracking-widest uppercase bg-primary hover:bg-primary-hover text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Financials() {
  const {
    stats = {},
    mutations = [],
    payouts = [],
    companyFeePercentage = 0,
    earningTimeSeries = [],
  } = usePage().props;
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  const canSubmit = useMemo(() => {
    const amount = Number(requestAmount);
    return amount > 0 && amount <= Number(stats.availableBalance ?? 0);
  }, [requestAmount, stats.availableBalance]);

  const submitPayoutRequest = () => {
    if (!canSubmit || submitting) {
      return;
    }

    setSubmitting(true);
    router.post(
      route("instructor.financial.payout-requests.store"),
      {
        requested_amount: Number(requestAmount),
        note: requestNote,
      },
      {
        preserveScroll: true,
        only: ["stats", "mutations", "payouts"],
        onFinish: () => {
          setSubmitting(false);
        },
        onSuccess: () => {
          setRequestAmount("");
          setRequestNote("");
          setShowPayoutModal(false);
        },
      },
    );
  };

  return (
    <MainLayout title="Financials" breadcrumb="Finance">
      <div className="p-8 flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">
            Financial Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track account mutation and your payout requests.
          </p>
        </div>

        <PeriodFilterChart
          title="Tren Pendapatan Bersih"
          rawData={earningTimeSeries}
          dataKeys={[{ key: "amount" }]}
          chartConfig={EARNING_CONFIG}
          type="area"
          formatValue={(v) => formatRp(v)}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
              Available Balance
            </p>
            <p className="text-2xl font-black text-foreground">
              {formatRp(stats.availableBalance)}
            </p>
          </div>
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
              Pending Payout
            </p>
            <p className="text-2xl font-black text-foreground">
              {formatRp(stats.pendingPayout)}
            </p>
          </div>
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
              Lifetime Earnings
            </p>
            <p className="text-2xl font-black text-foreground">
              {formatRp(stats.lifetimeEarning)}
            </p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black text-foreground uppercase tracking-widest">
                Account Mutation
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Fee perusahaan saat ini{" "}
                <span className="font-bold text-foreground">
                  {fmtPercent(companyFeePercentage)}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPayoutModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-extrabold tracking-widest uppercase bg-primary hover:bg-primary-hover text-white"
            >
              Request Payout
            </button>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Date",
                    "Class",
                    "Gross",
                    "Company Fee",
                    "Net Instructor",
                    "Status",
                    "Info",
                  ].map((header) => (
                    <th
                      key={header}
                      className="text-left py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mutations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-10 text-muted-foreground text-sm"
                    >
                      No account mutation yet
                    </td>
                  </tr>
                ) : (
                  mutations.map((mutation) => (
                    <tr key={mutation.id}>
                      <td className="py-3 text-xs text-foreground">
                        {fmtDateTime(mutation.earnedAt)}
                      </td>
                      <td className="py-3 text-xs font-semibold text-foreground">
                        {mutation.courseName}
                      </td>
                      <td className="py-3 text-xs text-foreground">
                        {formatRp(mutation.grossAmount)}
                      </td>
                      <td className="py-3 text-xs text-foreground">
                        <p>{formatRp(mutation.companyAmount)}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {fmtPercent(mutation.effectiveFeePercentage)}
                        </p>
                      </td>
                      <td className="py-3 text-xs font-semibold text-foreground">
                        {formatRp(mutation.instructorAmount)}
                      </td>
                      <td className="py-3">
                        <MutationStatusPill status={mutation.status} />
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {mutation.releasedAt
                          ? `Released ${fmtDateTime(mutation.releasedAt)}`
                          : mutation.availableAt
                            ? `Available ${fmtDateTime(mutation.availableAt)}`
                            : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <div className="mb-4">
            <p className="text-sm font-black text-foreground uppercase tracking-widest">
              Payout Requests
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Showing latest {payouts.length} requests
            </p>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Requested At",
                    "Amount Requested",
                    "Amount Approved",
                    "Status",
                    "Paid At",
                    "Transfer Reference",
                    "Note/Rejection Reason",
                  ].map((header) => (
                    <th
                      key={header}
                      className="text-left py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payouts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-10 text-muted-foreground text-sm"
                    >
                      No payout request yet
                    </td>
                  </tr>
                ) : (
                  payouts.map((payout) => (
                    <tr key={payout.id}>
                      <td className="py-3 text-xs text-foreground">
                        {fmtDateTime(payout.requestedAt)}
                      </td>
                      <td className="py-3 text-xs font-semibold text-foreground">
                        {formatRp(payout.requestedAmount)}
                      </td>
                      <td className="py-3 text-xs text-foreground">
                        {["draft", "pending"].includes(payout.status) ||
                        !payout.approvedAmount
                          ? "-"
                          : formatRp(payout.approvedAmount)}
                      </td>
                      <td className="py-3">
                        <PayoutStatusBadge status={payout.status} />
                      </td>
                      <td className="py-3 text-xs text-foreground">
                        {payout.paidAt ? fmtDateTime(payout.paidAt) : "-"}
                      </td>
                      <td className="py-3 text-xs text-foreground font-mono text-[11px]">
                        {payout.transferReference || "-"}
                      </td>
                      <td className="py-3 text-xs">
                        {payout.status === "rejected" ? (
                          <span className="text-red-700 dark:text-red-300">
                            {payout.rejectionReason || "-"}
                          </span>
                        ) : (
                          <span className="text-foreground">
                            {payout.note || "-"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showPayoutModal && (
        <RequestPayoutModal
          onClose={() => setShowPayoutModal(false)}
          onSubmit={submitPayoutRequest}
          canSubmit={canSubmit}
          requestAmount={requestAmount}
          setRequestAmount={setRequestAmount}
          requestNote={requestNote}
          setRequestNote={setRequestNote}
          submitting={submitting}
          availableBalance={Number(stats.availableBalance ?? 0)}
        />
      )}
    </MainLayout>
  );
}
