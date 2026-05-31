import Link from "@/Components/Link";
import { getGuestImageUrl, getGuestText } from "@/lib/guestPageContent";
import { LiveEditableText } from "./LiveEditor/GuestLiveEditorContext";

function TrainingCard({
  category,
  categoryColor,
  title,
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
    bg-card rounded-2xl overflow-hidden flex flex-col group cursor-pointer
    transition-all duration-500 ease-out
    hover:-translate-y-3 hover:scale-[1.02] hover:shadow-2xl
    ${featured ? "scale-105 shadow-xl z-10" : "shadow-md"}
  `}
    >
      <div className="h-40 overflow-hidden">
        <div
          className="w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
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

        <h3 className="font-black text-base tracking-tight leading-tight mb-1 transition-colors duration-200 group-hover:text-primary">
          {title}
        </h3>

        <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-3">
          BY {author}
        </p>

        <p className="text-muted-foreground text-xs leading-relaxed mb-4 flex-1">
          {description}
        </p>

        <div className="flex items-center gap-4 text-[11px] text-muted-foreground mb-5">
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
          <span className="text-primary font-black text-lg tracking-tight">
            Rp {price}
          </span>
          <Link
            href={route("guest.training")}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-foreground text-[10px] font-bold tracking-widest uppercase px-4 py-2.5 rounded-full transition-colors"
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

export function PopularTrainingSection({ content = {} }) {
  const sectionHeading = getGuestText(
    content,
    "home.popular.heading",
    "POPULAR TRAINING PROGRAMS",
  );
  const sectionDescription = getGuestText(
    content,
    "home.popular.description",
    "Explore industry-ready courses designed by certified professionals",
  );

  const courses = [
    {
      category: "Digital Construction",
      categoryColor: "bg-primary-soft text-primary border border-primary/20",
      title: "BIM MANAGEMENT PROFESSIONAL",
      author: "Ahmad Junaidi, M.Eng",
      description:
        "Master Building Information Modeling with industry-standard tools and workflows.",
      weeks: 8,
      level: "Advanced",
      rating: 4.9,
      price: "2.500.000",
      image: getGuestImageUrl(
        content,
        "home.media.popularCardImageFileIds.0",
        "/storage/images/bim.png",
      ),
    },
    {
      category: "Project Management",
      categoryColor:
        "bg-green-100 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900",
      title: "PROJECT MANAGEMENT EXCELLENCE",
      author: "Siti Aminah, PMP",
      description:
        "Comprehensive PM methodology aligned with international standards.",
      weeks: 6,
      level: "Intermediate",
      rating: 4.8,
      price: "1.850.000",
      image: getGuestImageUrl(
        content,
        "home.media.popularCardImageFileIds.1",
        "/storage/images/project-management.png",
      ),
      featured: true,
    },
    {
      category: "Digital Engineering",
      categoryColor:
        "bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-900",
      title: "GREEN BUILDING CERTIFICATION",
      author: "Budi Setiawan, LEED AP",
      description:
        "Learn sustainable design principles and LEED certification process.",
      weeks: 10,
      level: "Advanced",
      rating: 4.9,
      price: "3.100.000",
      image: getGuestImageUrl(
        content,
        "home.media.popularCardImageFileIds.2",
        "/storage/images/green-building.png",
      ),
    },
  ];

  return (
    <section className="bg-card py-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="mb-10">
          <LiveEditableText
            as="h2"
            path="home.popular.heading"
            className="text-4xl font-black text-foreground tracking-tight mb-2 whitespace-pre-line"
          >
            {sectionHeading}
          </LiveEditableText>
          <LiveEditableText
            as="p"
            path="home.popular.description"
            className="text-muted-foreground text-sm whitespace-pre-line"
          >
            {sectionDescription}
          </LiveEditableText>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {courses.map((course) => (
            <TrainingCard key={course.title} {...course} />
          ))}
        </div>

        <div className="text-center mt-12">
          <Link
            href={route("guest.training")}
            className="inline-flex items-center gap-3 bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold tracking-widest uppercase px-8 py-4 rounded-lg transition-colors"
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
