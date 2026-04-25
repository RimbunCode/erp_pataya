import { useState } from "react";
import MainLayout from "@/Layouts/MainLayout";

const wishlistItems = [
  {
    id: 1,
    title: "Structural Engineering Masterclass",
    instructor: "Prof. Bambang Sutrisno",
    price: 450000,
    rating: 4.8,
    reviews: 312,
    duration: "18h 30m",
    image: "https://picsum.photos/seed/structural/200/150",
    tag: "Bestseller",
    tagColor: "bg-amber-100 text-amber-600",
  },
  {
    id: 2,
    title: "Green Building & Sustainability",
    instructor: "Dr. Rina Kusuma",
    price: 380000,
    rating: 4.6,
    reviews: 198,
    duration: "12h 15m",
    image: "https://picsum.photos/seed/green/200/150",
    tag: "New",
    tagColor: "bg-green-100 text-green-600",
  },
  {
    id: 3,
    title: "Digital Twin Implementation",
    instructor: "Ir. Hendra Wijaya",
    price: 520000,
    rating: 4.9,
    reviews: 87,
    duration: "22h 0m",
    image: "https://picsum.photos/seed/twin/200/150",
    tag: null,
    tagColor: null,
  },
];

const cartItems = [
  {
    id: 1,
    title: "BIM Level 2 Certification Prep",
    instructor: "Ir. Ahmad Sudirman",
    price: 600000,
    image: "https://picsum.photos/seed/bim2/200/150",
  },
  {
    id: 2,
    title: "Construction Law & Contracts",
    instructor: "Dr. Siti Aminah",
    price: 320000,
    image: "https://picsum.photos/seed/law/200/150",
  },
];

function formatPrice(price) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(price);
}

function WishlistRow({ item, onMoveToCart, onRemove }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`bg-white rounded-2xl border-2 flex items-center gap-5 px-5 py-4 transition-all duration-200
        ${hovered ? "border-blue-500 shadow-lg shadow-blue-100 -translate-y-0.5" : "border-gray-100 shadow-lg shadow-gray-100"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div className="w-24 h-20 rounded-xl bg-blue-50 flex-shrink-0 overflow-hidden">
        <img
          src={item.image}
          alt={item.title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-black text-gray-700 uppercase tracking-wide leading-tight">
            {item.title}
          </h3>
          {item.tag && (
            <span
              className={`text-[9px] font-extrabold tracking-widest uppercase px-2 py-0.5 rounded-lg flex-shrink-0 ${item.tagColor}`}
            >
              {item.tag}
            </span>
          )}
        </div>
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">
          {item.instructor}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <svg
                key={s}
                className={`w-3 h-3 ${s <= Math.round(item.rating) ? "text-amber-400" : "text-gray-200"}`}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            ))}
            <span className="text-[10px] font-bold text-gray-400 ml-1">
              {item.rating} ({item.reviews})
            </span>
          </div>
          <span className="text-[10px] font-bold text-gray-300">·</span>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {item.duration}
          </span>
        </div>
      </div>

      {/* Price */}
      <div className="text-right flex-shrink-0">
        <p className="text-base font-black text-gray-700">
          {formatPrice(item.price)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onRemove(item.id)}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-300 hover:text-red-400 hover:border-red-200 hover:bg-red-50 transition-all duration-200"
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
        <button
          onClick={() => onMoveToCart(item.id)}
          className="flex items-center gap-2 px-4 py-2.5 text-[10px] font-extrabold tracking-widest uppercase rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          Add to Cart
        </button>
      </div>
    </div>
  );
}

function CartRow({ item, onRemove }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`bg-white rounded-2xl border-2 flex items-center gap-5 px-5 py-4 transition-all duration-200
        ${hovered ? "border-blue-500 shadow-lg shadow-blue-100 -translate-y-0.5" : "border-gray-100 shadow-lg shadow-gray-100"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div className="w-24 h-20 rounded-xl bg-blue-50 flex-shrink-0 overflow-hidden">
        <img
          src={item.image}
          alt={item.title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-black text-gray-700 uppercase tracking-wide leading-tight">
          {item.title}
        </h3>
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mt-1">
          {item.instructor}
        </p>
      </div>

      {/* Price */}
      <p className="text-base font-black text-gray-700 flex-shrink-0">
        {formatPrice(item.price)}
      </p>

      {/* Remove */}
      <button
        onClick={() => onRemove(item.id)}
        className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-300 hover:text-red-400 hover:border-red-200 hover:bg-red-50 transition-all duration-200 flex-shrink-0"
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
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  );
}

export default function WishlistCart() {
  const [wishlist, setWishlist] = useState(wishlistItems);
  const [cart, setCart] = useState(cartItems);
  const [activeTab, setActiveTab] = useState("wishlist");

  const removeFromWishlist = (id) =>
    setWishlist((prev) => prev.filter((i) => i.id !== id));
  const removeFromCart = (id) =>
    setCart((prev) => prev.filter((i) => i.id !== id));

  const moveToCart = (id) => {
    const item = wishlist.find((i) => i.id === id);
    if (!item) return;
    setCart((prev) => [
      ...prev,
      {
        id: item.id,
        title: item.title,
        instructor: item.instructor,
        price: item.price,
        image: item.image,
      },
    ]);
    setWishlist((prev) => prev.filter((i) => i.id !== id));
    setActiveTab("cart");
  };

  const total = cart.reduce((sum, i) => sum + i.price, 0);

  return (
    <MainLayout title="Wishlist & Cart" breadcrumb="Wishlist">
      <div className="p-8 flex flex-col gap-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-black text-gray-700 uppercase tracking-tight">
            Wishlist & Cart
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Save courses for later or proceed to checkout.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {[
            { key: "wishlist", label: `Wishlist (${wishlist.length})` },
            { key: "cart", label: `Cart (${cart.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 text-xs font-extrabold tracking-widest uppercase rounded-lg transition-all duration-200
                ${
                  activeTab === tab.key
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Wishlist Tab */}
        {activeTab === "wishlist" && (
          <div className="flex flex-col gap-4">
            {wishlist.length > 0 ? (
              wishlist.map((item) => (
                <WishlistRow
                  key={item.id}
                  item={item}
                  onMoveToCart={moveToCart}
                  onRemove={removeFromWishlist}
                />
              ))
            ) : (
              <div className="text-center py-20 text-gray-300 bg-white rounded-2xl border border-gray-100">
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-gray-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
                <p className="text-sm font-bold uppercase tracking-widest">
                  Your wishlist is empty
                </p>
              </div>
            )}
          </div>
        )}

        {/* Cart Tab */}
        {activeTab === "cart" && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 flex flex-col gap-4">
              {cart.length > 0 ? (
                cart.map((item) => (
                  <CartRow
                    key={item.id}
                    item={item}
                    onRemove={removeFromCart}
                  />
                ))
              ) : (
                <div className="text-center py-20 text-gray-300 bg-white rounded-2xl border border-gray-100">
                  <svg
                    className="w-12 h-12 mx-auto mb-3 text-gray-200"
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
              )}
            </div>

            {/* Order Summary */}
            <div className="flex flex-col gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">
                  Order Summary
                </h3>

                <div className="flex flex-col gap-3">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3"
                    >
                      <p className="text-xs font-semibold text-gray-500 leading-snug flex-1">
                        {item.title}
                      </p>
                      <p className="text-xs font-black text-gray-700 flex-shrink-0">
                        {formatPrice(item.price)}
                      </p>
                    </div>
                  ))}
                </div>

                <hr className="border-gray-100" />

                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold tracking-widest text-gray-400 uppercase">
                    Total
                  </span>
                  <span className="text-lg font-black text-gray-700">
                    {formatPrice(total)}
                  </span>
                </div>

                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold tracking-widest uppercase py-3.5 rounded-xl shadow-md shadow-blue-200 hover:-translate-y-0.5 transition-all duration-200">
                  Proceed to Checkout
                </button>

                <p className="text-[10px] font-bold text-center text-gray-300 uppercase tracking-widest">
                  Secure payment via Midtrans
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
