import { formatRp } from "../Utils/formatRp";
import useCart from "@/Hooks/useCart";
import { useState } from "react";
export default function CartPanel({
  cartItems,
  onClose,
  onRemove,
  onCheckout,
}) {
  const [selected, setSelected] = useState(cartItems.map((i) => i.id));
  const [showCheckout, setShowCheckout] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const toggleSelect = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );

  const toggleAll = () =>
    setSelected(
      selected.length === cartItems.length ? [] : cartItems.map((i) => i.id),
    );

  const selectedItems = cartItems.filter((i) => selected.includes(i.id));
  const total = selectedItems.reduce((sum, i) => sum + Number(i.price || 0), 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md z-50 bg-white shadow-2xl flex flex-col">
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 to-indigo-500 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">
              My Cart
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {cartItems.length} course{cartItems.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-500 transition-colors"
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
        </div>

        {/* Select all */}
        {cartItems.length > 0 && (
          <div className="px-6 py-3 border-b border-gray-50 flex-shrink-0">
            <label className="flex items-center gap-2.5 cursor-pointer w-fit">
              <div
                onClick={toggleAll}
                className={`w-4 h-4 rounded flex items-center justify-center transition-all flex-shrink-0 cursor-pointer
                  ${selected.length === cartItems.length ? "bg-blue-600" : "border-2 border-gray-200 hover:border-blue-400"}`}
              >
                {selected.length === cartItems.length && (
                  <svg
                    className="w-2.5 h-2.5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
              <span className="text-xs font-bold text-gray-500">
                Select All ({selected.length}/{cartItems.length})
              </span>
            </label>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-300">
              <svg
                className="w-16 h-16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p className="text-sm font-bold uppercase tracking-widest">
                Your cart is empty
              </p>
            </div>
          ) : (
            cartItems.map((item) => {
              const isSelected = selected.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all duration-200 cursor-pointer
                    ${isSelected ? "border-blue-400 bg-blue-50" : "border-gray-100 bg-white"}`}
                  onClick={() => toggleSelect(item.id)}
                >
                  {/* Checkbox */}
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all
                    ${isSelected ? "bg-blue-600" : "border-2 border-gray-200"}`}
                  >
                    {isSelected && (
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Thumbnail */}
                  <div className="w-14 h-12 rounded-xl overflow-hidden flex-shrink-0">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-gray-700 uppercase leading-tight line-clamp-2">
                      {item.title}
                    </p>
                    <p className="text-[10px] font-bold text-blue-600 mt-1">
                      {formatRp(item.price)}
                    </p>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer — checkout */}
        {cartItems.length > 0 && (
          <div className="px-6 py-5 border-t border-gray-100 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {selected.length} item{selected.length !== 1 ? "s" : ""}{" "}
                selected
              </span>
              <span className="text-lg font-black text-gray-800">
                {formatRp(total)}
              </span>
            </div>
            <button
              disabled={selected.length === 0}
              onClick={() => onCheckout(selectedItems)}
              className={`w-full py-3.5 text-xs font-extrabold tracking-widest uppercase rounded-xl transition-all duration-200
                ${
                  selected.length > 0
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:-translate-y-0.5"
                    : "bg-gray-100 text-gray-300 cursor-not-allowed"
                }`}
            >
              Checkout ({selected.length})
            </button>
            <p className="text-[10px] font-bold text-center text-gray-300 uppercase tracking-widest mt-3">
              Secure payment via Midtrans
            </p>
          </div>
        )}
      </div>
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowCheckout(false)}
          />

          {/* modal box */}
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-700">
                Checkout Summary
              </h3>

              <button
                onClick={() => setShowCheckout(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* isi sama kayak order summary lo */}
            <div className="flex flex-col gap-3 max-h-64 overflow-y-auto">
              {cartItems.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <p className="text-xs text-gray-500 font-semibold">
                    {item.title}
                  </p>
                  <p className="text-xs font-black text-gray-700">
                    {formatRp(item.price)}
                  </p>
                </div>
              ))}
            </div>

            <hr className="my-4 border-gray-100" />

            <div className="flex justify-between mb-4">
              <span className="text-xs font-extrabold uppercase tracking-widest text-gray-400">
                Total
              </span>
              <span className="text-lg font-black text-gray-800">
                {formatRp(total)}
              </span>
            </div>

            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold uppercase tracking-widest py-3 rounded-xl">
              Pay Now
            </button>
          </div>
        </div>
      )}
    </>
  );
}
