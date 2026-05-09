import Link from "@/Components/Link";

export function PopularTrainingSection() {
  // ── Training Card
  function TrainingCard({
    category,
    categoryColor,
    title,
    titleColor,
    author,
    description,
    weeks,
    level,
    rating,
    price,
    image,
    featured,
  }) {
    return (
      <div
        className={`
    bg-white rounded-2xl overflow-hidden flex flex-col group cursor-pointer
    transition-all duration-500 ease-out
    hover:-translate-y-3 hover:scale-[1.02] hover:shadow-2xl
    ${featured ? "scale-105 shadow-xl z-10" : "shadow-md"}
  `}
      >
        {/* Image — tambah overflow-hidden + scale di dalam */}
        <div className="h-40 overflow-hidden">
          <div
            className={`w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-110`}
            style={{
              backgroundImage: `url(${image})`,
            }}
          />
        </div>

        <div className="p-6 flex flex-col flex-1">
          <span
            className={`self-start text-[9px] font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-3 ${categoryColor}`}
          >
            {category}
          </span>

          {/* Title — selalu berubah biru saat hover card */}
          <h3 className="font-black text-base tracking-tight leading-tight mb-1 transition-colors duration-200 group-hover:text-blue-600">
            {title}
          </h3>

          <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-3">
            BY {author}
          </p>

          <p className="text-gray-500 text-xs leading-relaxed mb-4 flex-1">
            {description}
          </p>

          <div className="flex items-center gap-4 text-[11px] text-gray-500 mb-5">
            <span className="flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              {weeks} Weeks
            </span>
            <span className="flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              {level}
            </span>
            <span className="flex items-center gap-1 ml-auto">
              <svg
                className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {rating}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-blue-600 font-black text-lg tracking-tight">
              Rp {price}
            </span>
            <Link
              href="/training"
              className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white text-[10px] font-bold tracking-widest uppercase px-4 py-2.5 rounded-full transition-colors"
            >
              VIEW DETAILS
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="3"
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    );
  }
  const courses = [
    {
      category: "Digital Construction",
      categoryColor: "bg-blue-50 text-blue-500 border border-blue-100",
      title: "BIM MANAGEMENT PROFESSIONAL",
      titleColor: "text-blue-600",
      author: "Ahmad Junaidi, M.Eng",
      description:
        "Master Building Information Modeling with industry-standard tools and workflows.",
      weeks: 8,
      level: "Advanced",
      rating: 4.9,
      price: "2.500.000",
      image: "/storage/images/bim.png",
    },
    {
      category: "Project Management",
      categoryColor: "bg-green-50 text-green-600 border border-green-100",
      title: "PROJECT MANAGEMENT EXCELLENCE",
      titleColor: "text-gray-900",
      author: "Siti Aminah, PMP",
      description:
        "Comprehensive PM methodology aligned with international standards.",
      weeks: 6,
      level: "Intermediate",
      rating: 4.8,
      price: "1.850.000",
      image: "/storage/images/project-management.png",
      featured: true,
    },
    {
      category: "Digital Engineering",
      categoryColor: "bg-purple-50 text-purple-500 border border-purple-100",
      title: "GREEN BUILDING CERTIFICATION",
      titleColor: "text-gray-900",
      author: "Budi Setiawan, LEED AP",
      description:
        "Learn sustainable design principles and LEED certification process.",
      weeks: 10,
      level: "Advanced",
      rating: 4.9,
      price: "3.100.000",
      image: "/storage/images/green-building.png",
    },
  ];

  return (
    <section className="bg-white py-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Heading */}
        <div className="mb-10">
          <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-2">
            POPULAR TRAINING PROGRAMS
          </h2>
          <p className="text-gray-400 text-sm">
            Explore industry-ready courses designed by certified professionals
          </p>
        </div>

        {/* Cards grid — middle card is slightly elevated */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {courses.map((c) => (
            <TrainingCard key={c.title} {...c} />
          ))}
        </div>

        {/* CTA Button */}
        <div className="text-center mt-12">
          <Link
            href="/guest-training"
            className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold tracking-widest uppercase px-8 py-4 rounded-lg transition-colors"
          >
            VIEW ALL TRAINING PROGRAMS
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
