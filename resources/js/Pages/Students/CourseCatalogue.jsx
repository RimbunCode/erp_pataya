import { useState } from "react";
import { router, usePage } from "@inertiajs/react";
import Mainlayout from "@/Layouts/MainLayout";
import useCart from "@/Hooks/useCart";
import { useSessionStorage } from "@/Hooks/useSessionStorage";
import CartPanel from "./Components/CartPanel";
import CheckoutModal from "@/Components/CheckoutModal";
import CourseCard from "./Components/CourseCard";
import CourseCompare from "./Components/CourseCompare";

export default function CourseCatalogue() {
  const { courses: initialCourses = [], cartCourses: initialCart = [] } =
    usePage().props;
  const { courses, cart, addToCart, removeFromCart, resetCart } = useCart(
    initialCourses,
    initialCart,
  );
  const [showCart, setShowCart] = useState(false);
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("All");
  const [showPayment, setShowPayment] = useState(false);
  const [checkoutItems, setCheckoutItems] = useState([]);
  const [compareList, setCompareList] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [viewMode, setViewMode] = useSessionStorage("catalogViewMode", "grid");

  const filtered = courses.filter((c) => {
    const matchSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.instructor.toLowerCase().includes(search.toLowerCase());
    const matchLevel =
      filterLevel === "All" || c.level === filterLevel.toLowerCase();
    return matchSearch && matchLevel;
  });

  const toggleCompare = (course) => {
    setCompareList((prev) => {
      const exists = prev.find((c) => c.id === course.id);
      if (exists) return prev.filter((c) => c.id !== course.id);
      if (prev.length >= 3) return prev;
      return [...prev, course];
    });
  };

  if (showCompare) {
    return (
      <CourseCompare
        selected={compareList}
        onBack={() => setShowCompare(false)}
      />
    );
  }

  return (
    <Mainlayout title="Course Catalogue" breadcrumb="Course Catalogue">
      <div className="p-8 flex flex-col gap-6">
        {/* ── Header ── */}
        <div className="text-center py-6">
          <h2 className="text-3xl font-black text-foreground uppercase tracking-tight mb-2">
            Course Catalogue
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Browse and enroll in professional engineering courses.
          </p>

          {/* Search */}
          <div className="flex items-center gap-3 max-w-xl mx-auto mt-6 bg-card rounded-2xl border shadow-sm px-5 py-3">
            <svg
              className="w-5 h-5 text-muted-foreground flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search courses or instructors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm text-foreground placeholder-muted-foreground border-none focus:border-none bg-transparent"
            />
          </div>
        </div>

        {/* ── Filters + Toggle ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
            {["All", "Beginner", "Intermediate", "Advanced"].map((f) => (
              <button
                key={f}
                onClick={() => setFilterLevel(f)}
                className={`px-4 py-2 text-[10px] font-extrabold tracking-widest uppercase rounded-lg transition-all duration-200
                  ${filterLevel === f ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {filtered.length} results
            </p> */}
            <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors
                  ${viewMode === "grid" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors
                  ${viewMode === "list" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
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
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── Course Grid/List ── */}
        {filtered.length > 0 ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-3 gap-5">
              {filtered.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  inCart={cart.some((c) => c.id === course.id)}
                  onAddToCart={addToCart}
                  onRemoveFromCart={removeFromCart}
                  viewMode="grid"
                  isSelected={compareList.some((c) => c.id === course.id)}
                  onToggleCompare={toggleCompare}
                  compareCount={compareList.length}
                  onCheckout={(items) => {
                    setCheckoutItems(items);
                    setShowPayment(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filtered.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  inCart={cart.some((c) => c.id === course.id)}
                  onAddToCart={addToCart}
                  onRemoveFromCart={removeFromCart}
                  viewMode="list"
                  isSelected={compareList.some((c) => c.id === course.id)}
                  onToggleCompare={toggleCompare}
                  compareCount={compareList.length}
                  onCheckout={(items) => {
                    setCheckoutItems(items);
                    setShowPayment(true);
                  }}
                />
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-20 bg-card rounded-2xl border border-border">
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              No courses found
            </p>
          </div>
        )}
      </div>

      {/* ── Floating Cart Button ── */}
      <button
        onClick={() => setShowCart(true)}
        className="fixed bottom-8 right-8 z-30 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl transition-all duration-200 hover:-translate-y-0.5"
        style={{
          background: "linear-gradient(135deg, #0f172a 60%, #1e3a8a 100%)",
        }}
      >
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
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <span className="text-xs font-extrabold tracking-widest text-white uppercase">
          My Cart
        </span>
        {cart.length > 0 && (
          <span className="w-5 h-5 rounded-full bg-primary-soft0 flex items-center justify-center text-[10px] font-black text-white">
            {cart.length}
          </span>
        )}
      </button>

      {/* Cart Panel */}
      {showCart && (
        <CartPanel
          cartItems={cart}
          onClose={() => setShowCart(false)}
          onRemove={removeFromCart}
          onCheckout={(items) => {
            setCheckoutItems(items);
            setShowCart(false);
            setShowPayment(true);
          }}
        />
      )}
      {showPayment && (
        <CheckoutModal
          items={checkoutItems}
          total={checkoutItems.reduce(
            (sum, i) => sum + Number(i.price || 0),
            0,
          )}
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            setShowPayment(false);
            router.reload();
          }}
          skipSuccessScreen
        />
      )}
      {compareList.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
          <div
            className="flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl"
            style={{
              background: "linear-gradient(135deg, #0f172a 60%, #1e3a8a 100%)",
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-primary flex items-center justify-center">
                <span className="text-xs font-black text-white">
                  {compareList.length}
                </span>
              </div>
              <span className="text-sm font-extrabold tracking-widest text-white uppercase">
                Compare Selected Trainings
              </span>
            </div>
            <div className="flex items-center gap-2">
              {compareList.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-1.5 bg-card/10 rounded-xl px-3 py-1.5"
                >
                  <span className="text-xs font-bold text-white/80 truncate max-w-24">
                    {c.title.split(" ").slice(0, 3).join(" ")}...
                  </span>
                  <button
                    onClick={() => toggleCompare(c)}
                    className="text-white/50 hover:text-white transition-colors"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowCompare(true)}
              disabled={compareList.length < 2}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold tracking-widest uppercase transition-all duration-200
                  ${compareList.length >= 2 ? "bg-primary hover:bg-primary-hover text-white hover:-translate-y-0.5" : "bg-card/10 text-white/40 cursor-not-allowed"}`}
            >
              Compare Now
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </Mainlayout>
  );
}
