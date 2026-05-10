import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
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
      <div className="fixed right-0 top-0 h-full w-full max-w-md z-50 bg-card shadow-2xl flex flex-col">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary to-indigo-500 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border flex-shrink-0">
          <div>
            <h3 className="text-sm font-black text-foreground uppercase tracking-tight">
              My Cart
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {cartItems.length} course{cartItems.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-muted-foreground transition-colors"
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
          <div className="px-6 py-3 border-b border-border flex-shrink-0">
            <label className="flex items-center gap-2.5 cursor-pointer w-fit">
              <div
                onClick={toggleAll}
                className={`w-4 h-4 rounded flex items-center justify-center transition-all flex-shrink-0 cursor-pointer
                  ${selected.length === cartItems.length ? "bg-primary" : "border-2 border-border hover:border-primary/40"}`}
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
              <span className="text-xs font-bold text-muted-foreground">
                Select All ({selected.length}/{cartItems.length})
              </span>
            </label>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
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
                    ${isSelected ? "border-primary/40 bg-primary-soft" : "border-border bg-card"}`}
                  onClick={() => toggleSelect(item.id)}
                >
                  {/* Checkbox */}
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all
                    ${isSelected ? "bg-primary" : "border-2 border-border"}`}
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
                    <Avatar className="relative w-full h-auto border rounded-xl aspect-square  group">
                      {cartItems.thumbnail && (
                        <AvatarImage
                          src={
                            route("files.preview", cartItems.thumbnail) +
                            `?v=${new Date(cartItems.updated_at).getTime()}`
                          }
                          alt={cartItems.name}
                        />
                      )}
                      <AvatarFallback className="rounded-lg object-fit">
                        <img
                          src="/storage/images/logo-default.png"
                          alt={cartItems.title}
                          className="w-full h-full object-fit"
                        />
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-foreground uppercase leading-tight line-clamp-2">
                      {item.title}
                    </p>
                    <p className="text-[10px] font-bold text-primary mt-1">
                      {formatRp(item.price)}
                    </p>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
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
          <div className="px-6 py-5 border-t border-border flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                {selected.length} item{selected.length !== 1 ? "s" : ""}{" "}
                selected
              </span>
              <span className="text-lg font-black text-foreground">
                {formatRp(total)}
              </span>
            </div>
            <button
              disabled={selected.length === 0}
              onClick={() => onCheckout(selectedItems)}
              className={`w-full py-3.5 text-xs font-extrabold tracking-widest uppercase rounded-xl transition-all duration-200
                ${
                  selected.length > 0
                    ? "bg-primary hover:bg-primary-hover text-white shadow-md shadow-primary/20 hover:-translate-y-0.5"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
            >
              Checkout ({selected.length})
            </button>
            <p className="text-[10px] font-bold text-center text-muted-foreground uppercase tracking-widest mt-3">
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
          <div className="relative w-full max-w-2xl bg-card rounded-2xl shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground">
                Checkout Summary
              </h3>

              <button
                onClick={() => setShowCheckout(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {/* isi sama kayak order summary lo */}
            <div className="flex flex-col gap-3 max-h-64 overflow-y-auto">
              {cartItems.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <p className="text-xs text-muted-foreground font-semibold">
                    {item.title}
                  </p>
                  <p className="text-xs font-black text-foreground">
                    {formatRp(item.price)}
                  </p>
                </div>
              ))}
            </div>

            <hr className="my-4 border-border" />

            <div className="flex justify-between mb-4">
              <span className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
                Total
              </span>
              <span className="text-lg font-black text-foreground">
                {formatRp(total)}
              </span>
            </div>

            <button className="w-full bg-primary hover:bg-primary-hover text-white text-xs font-extrabold uppercase tracking-widest py-3 rounded-xl">
              Pay Now
            </button>
          </div>
        </div>
      )}
    </>
  );
}
