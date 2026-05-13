import MainLayout from "@/Layouts/MainLayout";
import { Link, router } from "@inertiajs/react";
import { formatRp } from "../Utils/formatRp";

export default function CourseCompare({ selected, onBack }) {
  const threeCol = selected.length === 3;
  const cols = threeCol ? "grid-cols-3" : "grid-cols-2";

  return (
    <MainLayout>
      <div className="min-h-screen bg-muted">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground uppercase hover:text-foreground transition-colors mb-8"
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
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Catalogue
          </button>

          <h1 className="text-5xl font-black text-foreground uppercase tracking-tight mb-2">
            Compare Trainings
          </h1>
          <p className="text-base text-muted-foreground mb-10">
            Analyze side-by-side and choose the path that best fits your career
            goals.
          </p>

          <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
            {/* Header */}
            <div className={`grid border-b border-border ${cols}`}>
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-8 ${i > 0 ? "border-l border-border" : ""}`}
                >
                  <span className="text-[10px] font-extrabold tracking-[2px] text-primary uppercase block mb-3">
                    {course.categories?.[0] ?? "General"}
                  </span>
                  <h3 className="text-lg font-black text-foreground uppercase tracking-tight leading-tight mb-2">
                    {course.title}
                  </h3>
                  <p className="text-[10px] font-bold tracking-[2px] text-primary uppercase mb-3">
                    By {course.instructor}
                  </p>
                  <div className="mb-5">
                    <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase mb-1">
                      Investment
                    </p>
                    <p className="text-3xl font-black text-primary">
                      {formatRp(course.price)}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      router.visit(route("guest.training.preview", course.id))
                    }
                    className="w-full bg-primary hover:bg-primary-hover text-white font-extrabold tracking-widest uppercase text-xs py-4 rounded-xl shadow-md shadow-primary/20 transition-all duration-200"
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>

            {/* Description */}
            <div className={`grid border-b border-border ${cols}`}>
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-6 ${i > 0 ? "border-l border-border" : ""}`}
                >
                  <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase mb-3">
                    Description
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {course.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Level */}
            <div className={`grid border-b border-border ${cols}`}>
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-5 ${i > 0 ? "border-l border-border" : ""}`}
                >
                  <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase mb-3">
                    Level
                  </p>
                  <span className="text-xs font-extrabold tracking-widest uppercase px-3 py-1.5 bg-primary-soft text-primary rounded-lg capitalize">
                    {course.level}
                  </span>
                </div>
              ))}
            </div>

            {/* Duration */}
            <div className={`grid border-b border-border ${cols}`}>
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-5 flex items-center justify-between ${i > 0 ? "border-l border-border" : ""}`}
                >
                  <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase">
                    Duration
                  </p>
                  <p className="text-sm font-black text-foreground">
                    {course.total_hours}h ({course.total_sessions} Sessions)
                  </p>
                </div>
              ))}
            </div>

            {/* Certificate */}
            <div className={`grid border-b border-border ${cols}`}>
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-5 flex items-center justify-between ${i > 0 ? "border-l border-border" : ""}`}
                >
                  <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase">
                    Certificate
                  </p>
                  <p className="text-sm font-black text-foreground">
                    {course.certificate_type ?? "-"}
                  </p>
                </div>
              ))}
            </div>

            {/* Price */}
            <div className={`grid ${cols}`}>
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-6 flex items-center justify-between ${i > 0 ? "border-l border-border" : ""}`}
                >
                  <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase">
                    Total Price
                  </p>
                  <p className="text-2xl font-black text-primary">
                    {formatRp(course.price)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
