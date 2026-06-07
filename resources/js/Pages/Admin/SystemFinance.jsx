import MainLayout from "@/Layouts/MainLayout";
import { router, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import { STATUS_CFG, formatRp } from "@/lib/utils";
import { SettingsIcon } from "lucide-react";
import PeriodFilterChart from "@/Components/Charts/PeriodFilterChart";

const REVENUE_CONFIG = {
  amount: { label: "Pendapatan", color: "var(--primary)" },
};

const PAYMENT_STATUS_CONFIG = {
  approved: { label: "Disetujui", color: "#10b981" },
  pending: { label: "Pending", color: "#f59e0b" },
  rejected: { label: "Ditolak", color: "#ef4444" },
};

const METHOD_COLOR = {
  "Bank Transfer":
    "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  "Virtual Account":
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  QRIS: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
};

const fmtDate = (iso) => {
  if (!iso) {
    return "-";
  }

  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const fmtTime = (iso) => {
  if (!iso) {
    return "-";
  }

  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

function Icon({ d, cls = "w-4 h-4" }) {
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d={d}
      />
    </svg>
  );
}

function Avatar({ initials }) {
  return (
    <div className="w-8 h-8 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center text-xs font-bold shrink-0">
      {initials}
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cfg.pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function MethodBadge({ method }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${METHOD_COLOR[method] ?? "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300"}`}
    >
      {method}
    </span>
  );
}

function DetailDrawer({ item, onClose, onApprove, onReject }) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (!item) return null;

  const rejectionHistory = Array.isArray(item.rejectionHistory)
    ? item.rejectionHistory
    : [];

  return (
    <div className="w-80 shrink-0 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
          Payment Detail
        </p>
        <button
          onClick={onClose}
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <Icon d="M6 18L18 6M6 6l12 12" cls="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2.5">
            Student
          </p>
          <div className="flex items-center gap-3">
            <Avatar initials={item.avatar} />
            <div>
              <p className="text-sm font-bold text-[var(--foreground)]">
                {item.studentName}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {item.studentEmail}
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2.5">
            Course
          </p>
          <p className="text-sm font-semibold text-[var(--foreground)] leading-snug">
            {item.courseName}
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            {item.courseCategory} - {item.instructor}
          </p>
        </div>

        <div className="px-5 py-4 border-b border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-3">
            Payment Info
          </p>
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-[var(--muted-foreground)]">
                Transaction ID
              </p>
              <p className="text-xs text-[var(--foreground)] text-right">
                {item.id}
              </p>
            </div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-[var(--muted-foreground)]">Amount</p>
              <p className="text-xs font-bold text-[var(--foreground)] text-right">
                {formatRp(item.amount)}
              </p>
            </div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-[var(--muted-foreground)]">Method</p>
              <MethodBadge method={item.method} />
            </div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-[var(--muted-foreground)]">
                Reference Code
              </p>
              <p className="text-xs text-[var(--foreground)] text-right">
                {item.refCode}
              </p>
            </div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-[var(--muted-foreground)]">
                Submitted
              </p>
              <p className="text-xs text-[var(--foreground)] text-right">
                {fmtDate(item.submittedAt)}, {fmtTime(item.submittedAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2.5">
            Student Note
          </p>
          <p className="text-xs text-[var(--foreground)] leading-relaxed bg-[var(--background-accent)] rounded-lg p-3">
            {item.studentNote?.trim()
              ? item.studentNote
              : "No note provided by student."}
          </p>
        </div>

        <div className="px-5 py-4 border-b border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-3">
            Proof of Payment
          </p>
          <a
            href={item.proofUrl}
            target="_blank"
            rel="noreferrer"
            className="border border-dashed border-[var(--border)] rounded-xl p-4 flex flex-col items-center gap-2 bg-[var(--background-accent)] cursor-pointer hover:bg-[var(--secondary)] transition-colors"
          >
            <Icon
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              cls="w-8 h-8 text-[var(--muted-foreground)]"
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Click to view uploaded receipt
            </p>
            <span className="text-[11px] font-semibold text-[var(--primary)] underline">
              {item.proofFileName ?? "Open proof"}
            </span>
          </a>
        </div>

        {item.status === "rejected" && item.rejectReason && (
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2">
              Rejection Note
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed bg-red-500/10 rounded-lg p-3">
              {item.rejectReason}
            </p>
          </div>
        )}

        {rejectionHistory.length > 0 && (
          <div className="px-5 py-4 border-b border-[var(--border)] space-y-2.5">
            <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold">
              Rejection History
            </p>
            {rejectionHistory.map((historyItem, index) => (
              <div
                key={historyItem.id ?? `${item.id}-rejection-${index}`}
                className="rounded-lg border border-red-500/20 bg-red-500/5 p-3"
              >
                <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                  {historyItem.reason ?? "-"}
                </p>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-2">
                  Rejected by {historyItem.reviewedBy ?? "-"} on{" "}
                  {fmtDate(historyItem.reviewedAt ?? historyItem.submittedAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[var(--border)]">
        {item.status === "pending" && !rejectMode && (
          <div className="flex gap-2">
            <button
              onClick={() => setRejectMode(true)}
              className="flex-1 py-2.5 text-xs font-semibold border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 hover:border-red-500/30 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={() => onApprove(item.id)}
              className="flex-1 py-2.5 text-xs font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
            >
              Confirm Payment
            </button>
          </div>
        )}

        {item.status === "pending" && rejectMode && (
          <div className="space-y-2">
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)..."
              rows={3}
              className="w-full text-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setRejectMode(false);
                  setRejectReason("");
                }}
                className="flex-1 py-2 text-xs font-medium border border-[var(--border)] rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!rejectReason.trim()) return;
                  onReject(item.id, rejectReason.trim());
                }}
                disabled={!rejectReason.trim()}
                className="flex-1 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Send Rejection
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
    <span
      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${cfg.pill}`}
    >
      {cfg.label}
    </span>
  );
}

export default function SystemFinance() {
  const {
    payments = [],
    payoutRequests = [],
    payoutDelayDays = 0,
    companyFeePercentage = 0,
    payoutStats = {},
    flash = {},
    revenueTimeSeries = [],
    paymentStatusTimeSeries = [],
  } = usePage().props;
  const [activeTab, setActiveTab] = useState("payments");

  const [selectedPaymentId, setSelectedPaymentId] = useState(null);
  const [paymentFilterStatus, setPaymentFilterStatus] = useState("all");
  const [paymentFilterMethod, setPaymentFilterMethod] = useState("all");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentSortBy, setPaymentSortBy] = useState("newest");

  const [selectedPayoutId, setSelectedPayoutId] = useState(null);
  const [payoutStatusFilter, setPayoutStatusFilter] = useState("all");
  const [payoutSearch, setPayoutSearch] = useState("");
  const [payoutDelayInput, setPayoutDelayInput] = useState(
    String(payoutDelayDays ?? 0),
  );
  const [companyFeeInput, setCompanyFeeInput] = useState(
    String(companyFeePercentage ?? 0),
  );
  const [payoutRejectReason, setPayoutRejectReason] = useState("");
  const [payoutReference, setPayoutReference] = useState("");
  const [payoutProofFile, setPayoutProofFile] = useState(null);
  const [savingPayout, setSavingPayout] = useState(false);
  const [savingDelay, setSavingDelay] = useState(false);
  const [savingCompanyFee, setSavingCompanyFee] = useState(false);
  const [settingsAlert, setSettingsAlert] = useState(null);
  const [delayValidationMessage, setDelayValidationMessage] = useState("");
  const [companyFeeValidationMessage, setCompanyFeeValidationMessage] =
    useState("");

  useEffect(() => {
    setPayoutDelayInput(String(payoutDelayDays ?? 0));
  }, [payoutDelayDays]);

  useEffect(() => {
    setCompanyFeeInput(String(companyFeePercentage ?? 0));
  }, [companyFeePercentage]);

  useEffect(() => {
    if (activeTab !== "settings") {
      return;
    }

    if (typeof flash.success === "string" && flash.success.trim() !== "") {
      setSettingsAlert({
        type: "success",
        message: flash.success,
      });
    }
  }, [activeTab, flash.success]);

  const paymentCounts = useMemo(
    () => ({
      all: payments.length,
      pending: payments.filter((payment) => payment.status === "pending")
        .length,
      approved: payments.filter((payment) => payment.status === "approved")
        .length,
      rejected: payments.filter((payment) => payment.status === "rejected")
        .length,
    }),
    [payments],
  );

  const payoutCounts = useMemo(
    () => ({
      all: payoutRequests.length,
      draft: payoutRequests.filter((request) => request.status === "draft")
        .length,
      pending: payoutRequests.filter((request) => request.status === "pending")
        .length,
      approved: payoutRequests.filter(
        (request) => request.status === "approved",
      ).length,
      rejected: payoutRequests.filter(
        (request) => request.status === "rejected",
      ).length,
      paid: payoutRequests.filter((request) => request.status === "paid")
        .length,
    }),
    [payoutRequests],
  );

  const totalRevenue = useMemo(
    () =>
      payments
        .filter((payment) => payment.status === "approved")
        .reduce((sum, payment) => sum + payment.amount, 0),
    [payments],
  );

  const pendingRevenue = useMemo(
    () =>
      payments
        .filter((payment) => payment.status === "pending")
        .reduce((sum, payment) => sum + payment.amount, 0),
    [payments],
  );

  const paymentMethodOptions = useMemo(
    () => [
      ...new Set(payments.map((payment) => payment.method).filter(Boolean)),
    ],
    [payments],
  );

  const filteredPayments = useMemo(() => {
    let list = payments;

    if (paymentFilterStatus !== "all") {
      list = list.filter((payment) => payment.status === paymentFilterStatus);
    }

    if (paymentFilterMethod !== "all") {
      list = list.filter((payment) => payment.method === paymentFilterMethod);
    }

    if (paymentSearch.trim()) {
      const query = paymentSearch.toLowerCase();
      list = list.filter(
        (payment) =>
          payment.studentName.toLowerCase().includes(query) ||
          payment.courseName.toLowerCase().includes(query) ||
          payment.id.toLowerCase().includes(query) ||
          payment.refCode.toLowerCase().includes(query),
      );
    }

    if (paymentSortBy === "newest") {
      list = [...list].sort(
        (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt),
      );
    } else if (paymentSortBy === "oldest") {
      list = [...list].sort(
        (a, b) => new Date(a.submittedAt) - new Date(b.submittedAt),
      );
    } else if (paymentSortBy === "highest") {
      list = [...list].sort((a, b) => b.amount - a.amount);
    } else if (paymentSortBy === "lowest") {
      list = [...list].sort((a, b) => a.amount - b.amount);
    }

    return list;
  }, [
    payments,
    paymentFilterMethod,
    paymentFilterStatus,
    paymentSearch,
    paymentSortBy,
  ]);

  const filteredPayouts = useMemo(() => {
    let list = payoutRequests;

    if (payoutStatusFilter !== "all") {
      list = list.filter((request) => request.status === payoutStatusFilter);
    }

    if (payoutSearch.trim()) {
      const query = payoutSearch.toLowerCase();
      list = list.filter(
        (request) =>
          request.instructorName.toLowerCase().includes(query) ||
          request.instructorEmail.toLowerCase().includes(query) ||
          request.id.toLowerCase().includes(query),
      );
    }

    return list;
  }, [payoutRequests, payoutSearch, payoutStatusFilter]);

  const selectedPayment = useMemo(
    () =>
      selectedPaymentId
        ? (payments.find((payment) => payment.id === selectedPaymentId) ?? null)
        : null,
    [payments, selectedPaymentId],
  );

  const selectedPayout = useMemo(
    () =>
      selectedPayoutId
        ? (payoutRequests.find((request) => request.id === selectedPayoutId) ??
          null)
        : null,
    [payoutRequests, selectedPayoutId],
  );

  const handleApprovePayment = (id) => {
    router.patch(
      route("admin.finance.approve", { payment: id }),
      {},
      {
        preserveScroll: true,
        only: ["payments", "payoutStats"],
      },
    );
  };

  const handleRejectPayment = (id, reason) => {
    router.patch(
      route("admin.finance.reject", { payment: id }),
      { reason },
      {
        preserveScroll: true,
        only: ["payments"],
      },
    );
  };

  const normalizeDelayValue = (rawValue) => {
    const trimmed = String(rawValue ?? "").trim();
    if (trimmed === "") {
      return 0;
    }

    if (!/^\d+$/.test(trimmed)) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isNaN(parsed)) {
      return null;
    }

    return Math.min(365, Math.max(0, parsed));
  };

  const normalizeCompanyFeeValue = (rawValue) => {
    const normalized = String(rawValue ?? "")
      .trim()
      .replace(",", ".");
    if (normalized === "") {
      return null;
    }

    const parsed = Number.parseFloat(normalized);
    if (Number.isNaN(parsed)) {
      return null;
    }

    return Math.min(100, Math.max(0, Number(parsed.toFixed(2))));
  };

  const handleSaveDelay = () => {
    const normalizedDelay = normalizeDelayValue(payoutDelayInput);
    if (normalizedDelay === null) {
      setDelayValidationMessage(
        "Delay harus berupa angka bulat antara 0 sampai 365.",
      );
      setSettingsAlert({
        type: "error",
        message: "Gagal menyimpan delay payout. Periksa nilai input.",
      });
      return;
    }

    setDelayValidationMessage("");
    setPayoutDelayInput(String(normalizedDelay));
    setSavingDelay(true);
    router.patch(
      route("admin.finance.settings.payout-delay"),
      {
        delay_days: normalizedDelay,
      },
      {
        preserveScroll: true,
        only: ["payoutDelayDays"],
        onSuccess: () => {
          setSettingsAlert({
            type: "success",
            message: "Pengaturan delay payout berhasil diperbarui.",
          });
        },
        onError: (errors) => {
          const message = errors?.delay_days;
          setDelayValidationMessage(
            Array.isArray(message)
              ? (message[0] ?? "")
              : (message ?? "Delay payout gagal diperbarui."),
          );
          setSettingsAlert({
            type: "error",
            message: "Gagal menyimpan delay payout.",
          });
        },
        onFinish: () => {
          setSavingDelay(false);
        },
      },
    );
  };

  const handleSaveCompanyFee = () => {
    const normalizedFee = normalizeCompanyFeeValue(companyFeeInput);
    if (normalizedFee === null) {
      setCompanyFeeValidationMessage(
        "Fee perusahaan harus berupa angka 0 sampai 100.",
      );
      setSettingsAlert({
        type: "error",
        message: "Gagal menyimpan fee perusahaan. Periksa nilai input.",
      });
      return;
    }

    setCompanyFeeValidationMessage("");
    setCompanyFeeInput(String(normalizedFee));
    setSavingCompanyFee(true);
    router.patch(
      route("admin.finance.settings.company-fee"),
      {
        company_fee_percentage: normalizedFee,
      },
      {
        preserveScroll: true,
        only: ["companyFeePercentage"],
        onSuccess: () => {
          setSettingsAlert({
            type: "success",
            message: "Pengaturan fee perusahaan berhasil diperbarui.",
          });
        },
        onError: (errors) => {
          const message = errors?.company_fee_percentage;
          setCompanyFeeValidationMessage(
            Array.isArray(message)
              ? (message[0] ?? "")
              : (message ?? "Fee perusahaan gagal diperbarui."),
          );
          setSettingsAlert({
            type: "error",
            message: "Gagal menyimpan fee perusahaan.",
          });
        },
        onFinish: () => {
          setSavingCompanyFee(false);
        },
      },
    );
  };

  const handleResetDelayToDefault = () => {
    setPayoutDelayInput("0");
    setDelayValidationMessage("");
    setSettingsAlert({
      type: "info",
      message: "Nilai delay diatur ke default 0 hari. Klik Save Delay.",
    });
  };

  const handleRunBatch = () => {
    router.post(
      route("admin.finance.payouts.batch"),
      {},
      {
        preserveScroll: true,
        only: ["payoutRequests", "payoutStats"],
      },
    );
  };

  const handleApprovePayout = (id) => {
    router.patch(
      route("admin.finance.payouts.approve", { payoutRequest: id }),
      {},
      {
        preserveScroll: true,
        only: ["payoutRequests", "payoutStats"],
      },
    );
  };

  const handleRejectPayout = (id) => {
    if (!payoutRejectReason.trim()) {
      return;
    }

    router.patch(
      route("admin.finance.payouts.reject", { payoutRequest: id }),
      {
        reason: payoutRejectReason,
      },
      {
        preserveScroll: true,
        only: ["payoutRequests", "payoutStats"],
        onSuccess: () => {
          setPayoutRejectReason("");
        },
      },
    );
  };

  const handleMarkPayoutPaid = (id) => {
    if (!payoutReference.trim() || !payoutProofFile || savingPayout) {
      return;
    }

    setSavingPayout(true);
    router.post(
      route("admin.finance.payouts.paid", { payoutRequest: id }),
      {
        _method: "patch",
        transfer_reference: payoutReference,
        proof_file: payoutProofFile,
      },
      {
        forceFormData: true,
        preserveScroll: true,
        only: ["payoutRequests", "payoutStats"],
        onFinish: () => {
          setSavingPayout(false);
        },
        onSuccess: () => {
          setPayoutReference("");
          setPayoutProofFile(null);
        },
      },
    );
  };

  return (
    <MainLayout>
      <div
        data-role="admin"
        className="flex h-screen bg-[var(--background)] overflow-hidden"
      >
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-black text-[var(--foreground)] tracking-tight">
                  SYSTEM FINANCE
                </h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                  Manage enrollment payments and instructor payout requests.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <PeriodFilterChart
                title="Pendapatan Terverifikasi"
                rawData={revenueTimeSeries}
                dataKeys={[{ key: "amount" }]}
                chartConfig={REVENUE_CONFIG}
                type="area"
                formatValue={(v) => formatRp(v)}
              />
              <PeriodFilterChart
                title="Distribusi Status Pembayaran"
                rawData={paymentStatusTimeSeries}
                dataKeys={[
                  { key: "approved" },
                  { key: "pending" },
                  { key: "rejected" },
                ]}
                chartConfig={PAYMENT_STATUS_CONFIG}
                type="bar"
                formatValue={(v) => v.toLocaleString("id-ID")}
              />
            </div>

            <div className="inline-flex border border-[var(--border)] rounded-lg overflow-hidden text-xs font-semibold">
              {[
                ["payments", "Enrollment Payments"],
                ["payouts", "Instructor Payouts"],
                ["settings", SettingsIcon],
              ].map(([key, Label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-4 py-2 transition-colors ${
                    activeTab === key
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
                  }`}
                >
                  {typeof Label === "string" ? (
                    <span>{Label}</span>
                  ) : (
                    <Label key={key} className="size-4" />
                  )}
                </button>
              ))}
            </div>

            {activeTab === "payments" && (
              <>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                    <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider leading-tight">
                      Confirmed Revenue
                    </p>
                    <p className="text-2xl font-black text-[var(--foreground)] leading-none mt-3">
                      {formatRp(totalRevenue)}
                    </p>
                    <p className="text-xs font-medium mt-1.5 text-emerald-600 dark:text-emerald-300">
                      {paymentCounts.approved} transactions
                    </p>
                  </div>
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                    <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider leading-tight">
                      Pending Amount
                    </p>
                    <p className="text-2xl font-black text-[var(--foreground)] leading-none mt-3">
                      {formatRp(pendingRevenue)}
                    </p>
                    <p className="text-xs font-medium mt-1.5 text-[var(--primary)]">
                      {paymentCounts.pending} awaiting review
                    </p>
                  </div>
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                    <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider leading-tight">
                      Total Transactions
                    </p>
                    <p className="text-2xl font-black text-[var(--foreground)] leading-none mt-3">
                      {paymentCounts.all}
                    </p>
                    <p className="text-xs font-medium mt-1.5 text-[var(--muted-foreground)]">
                      All time
                    </p>
                  </div>
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                    <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider leading-tight">
                      Rejected Payments
                    </p>
                    <p className="text-2xl font-black text-[var(--foreground)] leading-none mt-3">
                      {paymentCounts.rejected}
                    </p>
                    <p className="text-xs font-medium mt-1.5 text-red-600 dark:text-red-300">
                      Need revision
                    </p>
                  </div>
                </div>

                <div className="flex gap-4" style={{ minHeight: "420px" }}>
                  <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
                      <div className="flex border border-[var(--border)] rounded-lg overflow-hidden text-xs font-semibold">
                        {["all", "pending", "approved", "rejected"].map(
                          (status) => (
                            <button
                              key={status}
                              onClick={() => setPaymentFilterStatus(status)}
                              className={`px-3 py-1.5 capitalize transition-colors ${
                                paymentFilterStatus === status
                                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                                  : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
                              }`}
                            >
                              {status === "all"
                                ? `All (${paymentCounts.all})`
                                : `${status.charAt(0).toUpperCase() + status.slice(1)} (${paymentCounts[status]})`}
                            </button>
                          ),
                        )}
                      </div>

                      <input
                        value={paymentSearch}
                        onChange={(event) =>
                          setPaymentSearch(event.target.value)
                        }
                        placeholder="Search by student, course, trx, ref..."
                        className="ml-auto text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] w-64"
                      />

                      <select
                        value={paymentFilterMethod}
                        onChange={(event) =>
                          setPaymentFilterMethod(event.target.value)
                        }
                        className="text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                      >
                        <option value="all">All Methods</option>
                        {paymentMethodOptions.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>

                      <select
                        value={paymentSortBy}
                        onChange={(event) =>
                          setPaymentSortBy(event.target.value)
                        }
                        className="text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                      >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="highest">Highest Amount</option>
                        <option value="lowest">Lowest Amount</option>
                      </select>
                    </div>

                    <div className="flex-1 overflow-auto">
                      <table
                        className="w-full text-sm"
                        style={{ tableLayout: "fixed" }}
                      >
                        <colgroup>
                          <col style={{ width: "200px" }} />
                          <col style={{ width: "180px" }} />
                          <col style={{ width: "110px" }} />
                          <col style={{ width: "110px" }} />
                          <col style={{ width: "100px" }} />
                          <col style={{ width: "90px" }} />
                        </colgroup>
                        <thead className="sticky top-0 bg-[var(--card)] z-10">
                          <tr className="border-b border-[var(--border)]">
                            {[
                              "Student",
                              "Course",
                              "Amount",
                              "Method",
                              "Date",
                              "Status",
                            ].map((header) => (
                              <th
                                key={header}
                                className="text-left px-4 py-3 text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {filteredPayments.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className="text-center py-16 text-[var(--muted-foreground)]"
                              >
                                No transactions found
                              </td>
                            </tr>
                          ) : (
                            filteredPayments.map((payment) => {
                              const isActive = selectedPaymentId === payment.id;
                              return (
                                <tr
                                  key={payment.id}
                                  onClick={() =>
                                    setSelectedPaymentId(payment.id)
                                  }
                                  className={`cursor-pointer transition-colors ${
                                    isActive
                                      ? "bg-[var(--primary-soft)]"
                                      : "hover:bg-[var(--background-accent)]"
                                  }`}
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Avatar initials={payment.avatar} />
                                      <div className="min-w-0">
                                        <p
                                          className={`text-xs font-semibold truncate ${
                                            isActive
                                              ? "text-[var(--primary)]"
                                              : "text-[var(--foreground)]"
                                          }`}
                                        >
                                          {payment.studentName}
                                        </p>
                                        <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                                          {payment.id}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="text-xs text-[var(--foreground)] truncate font-medium">
                                      {payment.courseName}
                                    </p>
                                    <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                                      {payment.instructor}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="text-xs font-bold text-[var(--foreground)]">
                                      {formatRp(payment.amount)}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3">
                                    <MethodBadge method={payment.method} />
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="text-xs text-[var(--foreground)]">
                                      {fmtDate(payment.submittedAt)}
                                    </p>
                                    <p className="text-[10px] text-[var(--muted-foreground)]">
                                      {fmtTime(payment.submittedAt)}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3">
                                    <StatusBadge status={payment.status} />
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {selectedPayment && (
                    <DetailDrawer
                      item={selectedPayment}
                      onClose={() => setSelectedPaymentId(null)}
                      onApprove={handleApprovePayment}
                      onReject={handleRejectPayment}
                    />
                  )}
                </div>
              </>
            )}

            {activeTab === "payouts" && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                    <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider leading-tight">
                      Eligible Balance
                    </p>
                    <p className="text-2xl font-black text-[var(--foreground)] leading-none mt-3">
                      {formatRp(payoutStats.eligibleBalanceTotal ?? 0)}
                    </p>
                  </div>
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                    <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider leading-tight">
                      Pending Requests
                    </p>
                    <p className="text-2xl font-black text-[var(--foreground)] leading-none mt-3">
                      {formatRp(payoutStats.pendingRequestTotal ?? 0)}
                    </p>
                  </div>
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                    <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider leading-tight">
                      Total Paid
                    </p>
                    <p className="text-2xl font-black text-[var(--foreground)] leading-none mt-3">
                      {formatRp(payoutStats.paidTotal ?? 0)}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleRunBatch}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border)] hover:bg-[var(--secondary)]"
                  >
                    Run Payout Batch
                  </button>
                </div>

                <div className="flex gap-4" style={{ minHeight: "420px" }}>
                  <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
                      <div className="flex border border-[var(--border)] rounded-lg overflow-hidden text-xs font-semibold">
                        {[
                          "all",
                          "draft",
                          "pending",
                          "approved",
                          "rejected",
                          "paid",
                        ].map((status) => (
                          <button
                            key={status}
                            onClick={() => setPayoutStatusFilter(status)}
                            className={`px-3 py-1.5 capitalize transition-colors ${
                              payoutStatusFilter === status
                                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                                : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
                            }`}
                          >
                            {status === "all"
                              ? `All (${payoutCounts.all})`
                              : `${status} (${payoutCounts[status]})`}
                          </button>
                        ))}
                      </div>

                      <input
                        value={payoutSearch}
                        onChange={(event) =>
                          setPayoutSearch(event.target.value)
                        }
                        placeholder="Search instructor..."
                        className="ml-auto text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] w-64"
                      />
                    </div>

                    <div className="flex-1 overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-[var(--card)] z-10">
                          <tr className="border-b border-[var(--border)]">
                            {[
                              "Instructor",
                              "Amount",
                              "Source",
                              "Date",
                              "Status",
                            ].map((header) => (
                              <th
                                key={header}
                                className="text-left px-4 py-3 text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {filteredPayouts.length === 0 ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="text-center py-16 text-[var(--muted-foreground)]"
                              >
                                No payout requests found
                              </td>
                            </tr>
                          ) : (
                            filteredPayouts.map((payoutRequest) => (
                              <tr
                                key={payoutRequest.id}
                                onClick={() =>
                                  setSelectedPayoutId(payoutRequest.id)
                                }
                                className={`cursor-pointer transition-colors ${
                                  selectedPayoutId === payoutRequest.id
                                    ? "bg-[var(--primary-soft)]"
                                    : "hover:bg-[var(--background-accent)]"
                                }`}
                              >
                                <td className="px-4 py-3">
                                  <p className="text-xs font-semibold text-[var(--foreground)]">
                                    {payoutRequest.instructorName}
                                  </p>
                                  <p className="text-[10px] text-[var(--muted-foreground)]">
                                    {payoutRequest.instructorEmail}
                                  </p>
                                </td>
                                <td className="px-4 py-3 text-xs font-semibold">
                                  {formatRp(payoutRequest.requestedAmount)}
                                </td>
                                <td className="px-4 py-3 text-xs capitalize text-[var(--foreground)]">
                                  {payoutRequest.source}
                                </td>
                                <td className="px-4 py-3 text-xs text-[var(--foreground)]">
                                  {fmtDate(payoutRequest.requestedAt)}
                                </td>
                                <td className="px-4 py-3">
                                  <PayoutStatusBadge
                                    status={payoutRequest.status}
                                  />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {selectedPayout && (
                    <div className="w-80 shrink-0 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                        <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                          Payout Detail
                        </p>
                        <button
                          onClick={() => setSelectedPayoutId(null)}
                          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                        >
                          <Icon d="M6 18L18 6M6 6l12 12" cls="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                        <div>
                          <p className="text-sm font-bold text-[var(--foreground)]">
                            {selectedPayout.instructorName}
                          </p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {selectedPayout.instructorEmail}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <PayoutStatusBadge status={selectedPayout.status} />
                          <span className="text-[10px] uppercase text-[var(--muted-foreground)]">
                            {selectedPayout.source}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest">
                            Requested Amount
                          </p>
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            {formatRp(selectedPayout.requestedAmount)}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest">
                            Requested At
                          </p>
                          <p className="text-xs text-[var(--foreground)]">
                            {fmtDate(selectedPayout.requestedAt)},{" "}
                            {fmtTime(selectedPayout.requestedAt)}
                          </p>
                        </div>
                        {selectedPayout.rejectionReason && (
                          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                            <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest mb-1">
                              Rejection Reason
                            </p>
                            <p className="text-xs text-red-700 dark:text-red-300">
                              {selectedPayout.rejectionReason}
                            </p>
                          </div>
                        )}
                        {selectedPayout.transferReference && (
                          <div className="rounded-lg border border-[var(--border)] p-3">
                            <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest mb-1">
                              Transfer Reference
                            </p>
                            <p className="text-xs text-[var(--foreground)]">
                              {selectedPayout.transferReference}
                            </p>
                            {selectedPayout.proofUrl && (
                              <a
                                href={selectedPayout.proofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-block text-xs font-semibold text-[var(--primary)] hover:underline"
                              >
                                Open proof file
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="px-5 py-3 border-t border-[var(--border)] space-y-2">
                        {["draft", "pending"].includes(
                          selectedPayout.status,
                        ) && (
                          <>
                            <button
                              onClick={() =>
                                handleApprovePayout(selectedPayout.id)
                              }
                              className="w-full py-2 rounded-lg text-xs font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
                            >
                              Approve Request
                            </button>
                            <textarea
                              value={payoutRejectReason}
                              onChange={(event) =>
                                setPayoutRejectReason(event.target.value)
                              }
                              placeholder="Reason for rejection..."
                              rows={2}
                              className="w-full text-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] resize-none"
                            />
                            <button
                              onClick={() =>
                                handleRejectPayout(selectedPayout.id)
                              }
                              disabled={!payoutRejectReason.trim()}
                              className="w-full py-2 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Reject Request
                            </button>
                          </>
                        )}
                        {selectedPayout.status === "approved" && (
                          <>
                            <input
                              value={payoutReference}
                              onChange={(event) =>
                                setPayoutReference(event.target.value)
                              }
                              placeholder="Transfer reference (required)"
                              className="w-full text-xs border border-[var(--border)] rounded-lg px-2.5 py-2"
                            />
                            <input
                              type="file"
                              accept=".jpg,.jpeg,.png,.pdf"
                              onChange={(event) =>
                                setPayoutProofFile(
                                  event.target.files?.[0] ?? null,
                                )
                              }
                              className="w-full text-xs"
                            />
                            <button
                              onClick={() =>
                                handleMarkPayoutPaid(selectedPayout.id)
                              }
                              disabled={
                                savingPayout ||
                                !payoutReference.trim() ||
                                !payoutProofFile
                              }
                              className="w-full py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Mark as Paid
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === "settings" && (
              <div className="space-y-3">
                {settingsAlert?.message && (
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      settingsAlert.type === "success"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : settingsAlert.type === "error"
                          ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                          : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                    }`}
                  >
                    {settingsAlert.message}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">
                        Payout Delay (Days)
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">
                        Delay global sebelum saldo earning instructor menjadi
                        eligible untuk payout.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={payoutDelayInput}
                        onChange={(event) =>
                          setPayoutDelayInput(event.target.value)
                        }
                        className="w-24 text-xs border border-[var(--border)] bg-[var(--background)] rounded-lg px-2 py-1"
                      />
                      <button
                        onClick={handleSaveDelay}
                        disabled={savingDelay}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingDelay ? "Saving..." : "Save Delay"}
                      </button>
                      <button
                        onClick={handleResetDelayToDefault}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)]"
                      >
                        Reset ke 0
                      </button>
                    </div>
                    {delayValidationMessage && (
                      <p className="text-xs text-red-600 dark:text-red-300">
                        {delayValidationMessage}
                      </p>
                    )}
                  </div>

                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">
                        Company Fee (%)
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">
                        Persentase fee perusahaan dari setiap payment enrollment
                        yang di-approve.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={companyFeeInput}
                        onChange={(event) =>
                          setCompanyFeeInput(event.target.value)
                        }
                        className="w-28 text-xs border border-[var(--border)] bg-[var(--background)] rounded-lg px-2 py-1"
                      />
                      <button
                        onClick={handleSaveCompanyFee}
                        disabled={savingCompanyFee}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingCompanyFee ? "Saving..." : "Save Fee"}
                      </button>
                    </div>
                    {companyFeeValidationMessage && (
                      <p className="text-xs text-red-600 dark:text-red-300">
                        {companyFeeValidationMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
