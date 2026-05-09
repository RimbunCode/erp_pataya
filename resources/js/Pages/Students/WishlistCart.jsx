// resources/js/Pages/Students/WishlistCart.jsx

import { useRef, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import Mainlayout from "@/Layouts/MainLayout";
import useCart from "@/Hooks/useCart";
import CartPanel from "./Components/CartPanel";
import CheckoutModal from "./Components/CheckoutModal";
import CourseCard from "./Components/CourseCard";

// Logo default perusahaan — ganti path sesuai asset kamu
const DEFAULT_THUMBNAIL = "/storage/images/logo-default.png";

// ── Main Page ─────────────────────────────────────
export default function WishlistCart() {
  const { courses: initialCourses = [], cartCourses: initialCart = [] } =
    usePage().props;
  const { courses, cart, addToCart, removeFromCart, resetCart } = useCart(
    initialCourses,
    initialCart,
  );
  const [showCart, setShowCart] = useState(false);
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("All");
  const [viewMode, setViewMode] = useState("grid");
  const [showPayment, setShowPayment] = useState(false);
  const [checkoutItems, setCheckoutItems] = useState([]);

  console.log(courses);
  console.log(courses[0]);
  const filtered = courses.filter((c) => {
    const matchSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.instructor.toLowerCase().includes(search.toLowerCase());
    const matchLevel =
      filterLevel === "All" || c.level === filterLevel.toLowerCase();
    return matchSearch && matchLevel;
  });

  return (
    <Mainlayout title="Course Catalogue" breadcrumb="Enroll">
      <div className="p-8 flex flex-col gap-6">
        {/* ── Header ── */}
        <div className="text-center py-6">
          <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tight mb-2">
            Course Catalogue
          </h2>
          <p className="text-sm text-gray-400 max-w-lg mx-auto">
            Browse and enroll in professional engineering courses.
          </p>

          {/* Search */}
          <div className="flex items-center gap-3 max-w-xl mx-auto mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-3">
            <svg
              className="w-5 h-5 text-gray-300 flex-shrink-0"
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
              className="flex-1 text-sm text-gray-700 placeholder-gray-300 focus:outline-none bg-transparent"
            />
          </div>
        </div>

        {/* ── Filters + Toggle ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {["All", "Beginner", "Intermediate", "Advanced"].map((f) => (
              <button
                key={f}
                onClick={() => setFilterLevel(f)}
                className={`px-4 py-2 text-[10px] font-extrabold tracking-widest uppercase rounded-lg transition-all duration-200
                  ${filterLevel === f ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              {filtered.length} results
            </p> */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors
                  ${viewMode === "grid" ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
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
                  ${viewMode === "list" ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
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
                />
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <p className="text-sm font-bold uppercase tracking-widest text-gray-300">
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
          <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-black text-white">
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
        />
      )}
    </Mainlayout>
  );
}
