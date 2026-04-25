import { useState } from "react";
import { usePage } from "@inertiajs/react";
import MainLayout from "@/Layouts/MainLayout";

export default function ProfileSettings() {
  const { auth } = usePage().props;
  const user = auth?.user;

  const initials = user?.nickname
    ? user.nickname.slice(0, 1).toUpperCase()
    : (user?.name?.slice(0, 1).toUpperCase() ?? "S");

  const [form, setForm] = useState({
    fullName: user?.name ?? "",
    email: user?.email ?? "",
    title: "",
    phone: "",
    bio: "",
  });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleDiscard = () => {
    setForm({
      fullName: user?.name ?? "",
      email: user?.email ?? "",
      title: "",
      phone: "",
      bio: "",
    });
  };

  return (
    <MainLayout title="Profile Settings" breadcrumb="Profile">
      <div className="p-8 flex flex-col gap-8">
        {/* ── Avatar + Name ── */}
        <div className="flex items-center gap-6">
          <div className="relative flex-shrink-0">
            <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-400 bg-gray-50 flex items-center justify-center text-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50 hover:text-blue-400 transition-all duration-200">
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
            </div>
          </div>
          <div>
            <h2 className="text-2xl pl-4 font-black text-gray-600 uppercase tracking-tight">
              {user?.name ?? "Ahmad Faisal"}
            </h2>
            <p className="text-xs pl-4 font-extrabold tracking-widest text-blue-500 uppercase mt-1">
              Student Account
            </p>
            <div className="flex items-center gap-4 mt-3">
              <button className="text-xs font-extrabold tracking-widest text-gray-600 uppercase border border-gray-200 px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                Update Photo
              </button>
              <button className="text-xs font-extrabold tracking-widest text-red-400 uppercase hover:text-red-500 transition-colors">
                Remove
              </button>
            </div>
          </div>
        </div>

        {/* ── Form Card ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 flex flex-col gap-6">
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold tracking-[2px] text-black uppercase mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-400 shadow-md transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[2px] text-black uppercase mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-400 shadow-md transition-all"
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold tracking-[2px] text-black uppercase mb-2">
                Professional Title
              </label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Senior Structural Engineer"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-400 shadow-md transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[2px] text-black uppercase mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+62 812 XXXX XXXX"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-400 shadow-md transition-all"
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-[10px] font-bold tracking-[2px] text-black uppercase mb-2">
              Professional Bio
            </label>
            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              rows={5}
              placeholder="Tell us about your engineering background..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-400 transition-all resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <button
            onClick={handleDiscard}
            className="px-6 py-3 text-xs font-extrabold tracking-widest text-black uppercase border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Discard Changes
          </button>
          <button className="px-8 py-3 text-xs font-extrabold tracking-widest text-white uppercase bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-200 hover:-translate-y-0.5 transition-all duration-200">
            Save Profile Settings
          </button>
        </div>
      </div>
    </MainLayout>
  );
}
