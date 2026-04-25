// resources/js/Pages/Instructor/Financials.jsx

import { useState } from "react";
import MainLayout from "@/Layouts/MainLayout";

const transactions = [
  {
    id: "#TRX-001",
    type: "Payout",
    date: "12 Jan 2024",
    amount: 12500000,
    status: "success",
  },
  {
    id: "#TRX-002",
    type: "Course Sale",
    date: "11 Jan 2024",
    amount: 2500000,
    status: "success",
  },
  {
    id: "#TRX-003",
    type: "Platform Fee",
    date: "10 Jan 2024",
    amount: 250000,
    status: "pending",
  },
  {
    id: "#TRX-004",
    type: "Course Sale",
    date: "9 Jan 2024",
    amount: 1800000,
    status: "success",
  },
  {
    id: "#TRX-005",
    type: "Payout",
    date: "5 Jan 2024",
    amount: 8000000,
    status: "failed",
  },
];

const statusConfig = {
  success: { label: "Success", color: "text-green-600", bg: "bg-green-50" },
  pending: { label: "Pending", color: "text-amber-500", bg: "bg-amber-50" },
  failed: { label: "Failed", color: "text-red-400", bg: "bg-red-50" },
};

function formatRp(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function RequestPayoutModal({ onClose }) {
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [account, setAccount] = useState("");
  const isComplete = amount.trim() && bank.trim() && account.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-300 hover:text-gray-500 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-700 uppercase tracking-tight">
              Request Payout
            </h3>
            <p className="text-xs text-gray-400">
              Available balance:{" "}
              <span className="font-bold text-gray-600">Rp 42,500,000</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-2">
              Amount
            </label>
            <input
              type="number"
              placeholder="e.g. 5000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-300 shadow-sm transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-2">
              Bank Name
            </label>
            <input
              type="text"
              placeholder="e.g. BCA, Mandiri, BNI"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-300 shadow-sm transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-2">
              Account Number
            </label>
            <input
              type="text"
              placeholder="e.g. 1234567890"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-300 shadow-sm transition-all"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-7">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-xs font-extrabold tracking-widest text-gray-400 uppercase border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!isComplete}
            className={`flex-1 px-4 py-3 text-xs font-extrabold tracking-widest uppercase rounded-xl transition-all duration-200
              ${
                isComplete
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:-translate-y-0.5"
                  : "bg-gray-100 text-gray-300 cursor-not-allowed"
              }`}
          >
            Submit Request
          </button>
        </div>
      </div>
    </div>
  );
}

function TransactionRow({ item }) {
  const [hovered, setHovered] = useState(false);
  const config = statusConfig[item.status];

  return (
    <div
      className={`flex items-center gap-4 py-4 border-b border-gray-50 last:border-none -mx-2 px-2 rounded-xl transition-all duration-200 cursor-default
        ${hovered ? "bg-gray-50" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="w-32 flex-shrink-0">
        <p className="text-sm font-black text-gray-700">{item.id}</p>
      </div>
      <div className="flex-1">
        <p className="text-sm text-gray-600 font-semibold">{item.type}</p>
      </div>
      <div className="w-32 flex-shrink-0">
        <p className="text-sm text-gray-400">{item.date}</p>
      </div>
      <div className="w-40 flex-shrink-0">
        <p className="text-sm font-black text-gray-700">
          {formatRp(item.amount)}
        </p>
      </div>
      <div className="w-24 flex-shrink-0">
        <span
          className={`text-[10px] font-extrabold tracking-widest uppercase px-3 py-1.5 rounded-lg ${config.bg} ${config.color}`}
        >
          {config.label}
        </span>
      </div>
    </div>
  );
}

export default function Financials() {
  const [showPayout, setShowPayout] = useState(false);
  const [filter, setFilter] = useState("All");

  const filters = ["All", "Payout", "Course Sale", "Platform Fee"];

  const filtered =
    filter === "All"
      ? transactions
      : transactions.filter((t) => t.type === filter);

  return (
    <MainLayout title="Financials" breadcrumb="Finance">
      <div className="p-8 flex flex-col gap-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-700 uppercase tracking-tight">
              Financial Management
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Track your earnings and payout history.
            </p>
          </div>
          <button
            onClick={() => setShowPayout(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold tracking-widest uppercase bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-200 hover:-translate-y-0.5 transition-all duration-200"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
            Request Payout
          </button>
        </div>

        {/* ── Balance Cards ── */}
        <div className="grid grid-cols-3 gap-5">
          {[
            {
              label: "Total Balance",
              value: "Rp 42,500,000",
              sub: "Available for withdrawal",
            },
            {
              label: "Pending Payout",
              value: "Rp 4,200,000",
              sub: "Processing",
            },
            { label: "Lifetime Earnings", value: "Rp 1.2B", sub: "All time" },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7"
            >
              <p className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-3">
                {card.label}
              </p>
              <p className="text-3xl font-black text-gray-700">{card.value}</p>
              <p className="text-[10px] font-semibold text-gray-400 mt-2">
                {card.sub}
              </p>
            </div>
          ))}
        </div>

        {/* ── Transaction Table ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {/* Table header + filter */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">
              Transaction History
            </h3>
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-[10px] font-extrabold tracking-widest uppercase rounded-lg transition-all duration-200
                    ${
                      filter === f
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Column headers */}
          <div className="flex items-center gap-4 pb-3 border-b border-gray-100 -mx-2 px-2">
            <div className="w-32 flex-shrink-0">
              <span className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase">
                Transaction ID
              </span>
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase">
                Type
              </span>
            </div>
            <div className="w-32 flex-shrink-0">
              <span className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase">
                Date
              </span>
            </div>
            <div className="w-40 flex-shrink-0">
              <span className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase">
                Amount
              </span>
            </div>
            <div className="w-24 flex-shrink-0">
              <span className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase">
                Status
              </span>
            </div>
          </div>

          {/* Rows */}
          {filtered.length > 0 ? (
            filtered.map((item) => <TransactionRow key={item.id} item={item} />)
          ) : (
            <div className="text-center py-12 text-gray-300">
              <p className="text-sm font-bold uppercase tracking-widest">
                No transactions found
              </p>
            </div>
          )}
        </div>
      </div>

      {showPayout && (
        <RequestPayoutModal onClose={() => setShowPayout(false)} />
      )}
    </MainLayout>
  );
}
