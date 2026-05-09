import GuestLayout from "@/Layouts/GuestLayout";
import Link from "@/Components/Link";
import { useEffect, useState } from "react";
import { PopularTrainingSection } from "./PopularTrainingSection";
import { CTABannerSection } from "./CTABannerSection";
import { WhyInkindoSection } from "./WhyInkindo";

function FadingCard({ icon, title, subtitle, className }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible((v) => !v);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`absolute bg-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 transition-opacity duration-700 ease-in-out ${className}`}
      style={{ opacity: visible ? 1 : 0.3 }}
    >
      <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 text-white text-lg">
        {icon}
      </div>
      <div>
        <p className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold">
          {subtitle}
        </p>
        <p className="text-[11px] font-bold text-gray-800 tracking-wide uppercase">
          {title}
        </p>
      </div>
    </div>
  );
}

function BouncingCard({ icon, title, subtitle, className }) {
  return (
    <>
      <style>{`
        @keyframes gentle-bounce {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
        .bounce-card {
          animation: gentle-bounce 800ms ease-in-out infinite;
        }
      `}</style>
      <div
        className={`bounce-card absolute bg-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 ${className}`}
      >
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 text-white text-lg">
          {icon}
        </div>
        <div>
          <p className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold">
            {subtitle}
          </p>
          <p className="text-[11px] font-bold text-gray-800 tracking-wide uppercase">
            {title}
          </p>
        </div>
      </div>
    </>
  );
}

// ── Floating badge component ──────────────────────────────────────────────────
function Badge({ icon, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-blue-200 bg-white text-blue-600 text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full shadow-sm">
      <span>{icon}</span>
      {label}
    </span>
  );
}

// ── Star rating ───────────────────────────────────────────────────────────────
function Stars({ count = 5 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg
          key={i}
          className="w-4 h-4 text-yellow-400 fill-yellow-400"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// ── Avatar stack ──────────────────────────────────────────────────────────────
function AvatarStack() {
  const colors = [
    "bg-blue-400",
    "bg-pink-400",
    "bg-green-400",
    "bg-orange-400",
  ];
  const initials = ["AK", "BR", "CL", "DM"];
  return (
    <div className="flex -space-x-2">
      {colors.map((c, i) => (
        <div
          key={i}
          className={`w-8 h-8 rounded-full border-2 border-white ${c} flex items-center justify-center text-white text-[9px] font-bold`}
        >
          {initials[i]}
        </div>
      ))}
    </div>
  );
}

// ── Hero Section ──────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="relative bg-gray-50 overflow-hidden pt-16 pb-20">
      {/* subtle grid bg */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8 flex flex-col lg:flex-row items-center gap-12">
        {/* Left */}
        <div className="flex-1 flex flex-col gap-6 max-w-xl">
          <Badge icon="⚡" label="NEW: BIM CERTIFICATION 2024" />

          <h1 className="text-5xl lg:text-6xl font-black leading-tight tracking-tight text-gray-900">
            ENGINEER YOUR <span className="text-blue-600">DIGITAL FUTURE</span>
          </h1>

          <p className="text-gray-500 text-base leading-relaxed max-w-md">
            The official Learning Management System of INKINDO. Advanced
            training, professional certifications, and a community of experts.
          </p>

          <div className="flex items-center gap-4 flex-wrap">
            <Link
              href="/training"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold tracking-widest uppercase px-6 py-3.5 rounded-lg transition-colors"
            >
              START LEARNING
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>

            <button className="inline-flex items-center gap-3 text-gray-700 hover:text-blue-600 transition-colors group">
              <span className="w-10 h-10 rounded-full bg-white shadow border border-gray-100 flex items-center justify-center group-hover:shadow-md transition-shadow">
                <svg
                  className="w-4 h-4 text-blue-600 ml-0.5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span className="text-xs font-bold tracking-widest uppercase">
                HOW IT WORKS
              </span>
            </button>
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-3 mt-2">
            <AvatarStack />
            <div>
              <Stars />
              <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mt-0.5">
                12K+ CERTIFIED MEMBERS
              </p>
            </div>
          </div>
        </div>

        {/* Right – image + floating cards */}
        <div className="flex-1 relative flex justify-center items-center min-h-[420px]">
          <div className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <img
              src="/storage/images/hero-bg.png"
              alt="Engineering visualization"
              className="w-full aspect-[4/3] object-cover"
            />
          </div>

          {/* Top-right card */}
          <FadingCard
            icon="🏅"
            title="INDUSTRY READY"
            subtitle="GLOBAL STANDARDS"
            className="top-4 -right-4 lg:-right-8 z-10"
          />

          {/* Bottom-left card */}
          <BouncingCard
            icon="🛡️"
            title="ISO CERTIFIED LMS"
            subtitle="VERIFIED PROGRAM"
            className="bottom-8 left-0 lg:-left-4 z-10"
          />
        </div>
      </div>
    </section>
  );
}

// ── Trusted By Section ────────────────────────────────────────────────────────
function TrustedBy() {
  const companies = [
    "WIKA",
    "ADHI KARYA",
    "PP (PERSERO)",
    "HUTAMA KARYA",
    "WASZKITA",
  ];
  return (
    <section className="bg-white py-10 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-[10px] tracking-[0.25em] text-gray-400 uppercase font-semibold mb-6">
          TRUSTED BY INDUSTRY LEADERS
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-14">
          {companies.map((c) => (
            <span
              key={c}
              className="text-gray-300 font-black text-sm lg:text-base tracking-widest uppercase hover:text-gray-400 transition-colors"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <GuestLayout>
      <HeroSection />
      <TrustedBy />
      <PopularTrainingSection />
      <WhyInkindoSection />
      <CTABannerSection />
    </GuestLayout>
  );
}
