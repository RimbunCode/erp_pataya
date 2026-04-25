import Link from "@/Components/Link";

export function CTABannerSection() {
  return (
    <section className="bg-white py-10 px-6">
      <div className="max-w-5xl mx-auto bg-blue-600 rounded-3xl px-8 py-16 text-center shadow-xl shadow-blue-200">
        <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight mb-4">
          READY TO START
          <br />
          YOUR JOURNEY?
        </h2>
        <p className="text-blue-100 text-sm leading-relaxed mb-10 max-w-lg mx-auto">
          Join over 12,000 engineers who have leveled up their careers through
          our platform.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="bg-white text-blue-600 hover:bg-blue-50 text-xs font-black tracking-widest uppercase px-8 py-4 rounded-xl transition-colors min-w-[180px] text-center"
          >
            GET STARTED NOW
          </Link>
          <Link
            href="/guest-contact"
            className="border-2 border-white text-white hover:bg-white hover:text-blue-600 text-xs font-black tracking-widest uppercase px-8 py-4 rounded-xl transition-colors min-w-[180px] text-center"
          >
            CONTACT US
          </Link>
        </div>
      </div>
    </section>
  );
}
