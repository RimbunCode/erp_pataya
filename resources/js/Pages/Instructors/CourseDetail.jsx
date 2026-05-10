import { useRef, useState } from "react";
import { router } from "@inertiajs/react";
import MainLayout from "@/Layouts/MainLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { Accordion } from "@/Components/ui/accordion";
import { Button } from "@/Components/ui/button";
import { Trash2Icon, UploadIcon } from "lucide-react";
import Link from "@/Components/Link";
import { cn } from "@/lib/utils";
import { formatRp } from "./Utils/formatRp";
import { statusConfig } from "./Utils/statusConfig";
import { levelColor } from "./Components/CourseDetailConfig";
import CourseDetailEditModal from "./Components/CourseDetailEditModal";
import CourseDetailSectionBlock from "./Components/CourseDetailSectionBlock";
import CourseDetailStatCard from "./Components/CourseDetailStatCard";

export default function CourseDetail({ course, categories = [] }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const uploadDialogRef = useRef();
  const firstSectionValue = course.sections?.[0]
    ? `section-${course.sections[0].id}`
    : "";
  const [openSectionValue, setOpenSectionValue] = useState(firstSectionValue);

  const cfg = statusConfig[course.status] ?? statusConfig.draft;
  const levelCls =
    levelColor[course.level?.toLowerCase()] ?? "bg-muted text-muted-foreground";

  const addSection = () => {
    router.post(
      route("instructor.classes.sections.store", course.id),
      { title: "New Section" },
      { preserveScroll: true },
    );
  };

  const deleteSection = (sectionId) => {
    if (!confirm("Hapus section ini beserta semua konten dan note-nya?")) {
      return;
    }

    router.delete(route("instructor.classes.sections.destroy", sectionId), {
      preserveScroll: true,
    });
  };

  const totalContents =
    course.sections?.reduce(
      (sum, sectionItem) => sum + (sectionItem.contents?.length ?? 0),
      0,
    ) ?? 0;

  return (
    <MainLayout title="Course Detail" breadcrumb={course.title}>
      <div className="p-8 space-y-6">
        <button
          onClick={() => router.visit(route("instructor.classes.index"))}
          className="flex items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground uppercase hover:text-foreground transition-colors"
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
          Back to Courses
        </button>

        <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary to-indigo-500" />
          <div className="p-8 flex items-start gap-8">
            <div className="w-48 h-36 rounded-2xl overflow-hidden flex-shrink-0">
              <Avatar className="relative w-full h-auto border rounded-xl aspect-square group">
                {course.thumbnail && (
                  <AvatarImage
                    src={
                      route("files.preview", course.thumbnail) +
                      `?v=${new Date(course.updated_at).getTime()}`
                    }
                    alt={course.name}
                    className={cn("transition-[filter] group-hover:blur-sm")}
                  />
                )}
                <AvatarFallback className="rounded-lg">
                  <svg
                    className="w-12 h-12 text-white/30"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </AvatarFallback>
                <div className="absolute flex items-center justify-center w-full h-full transition-opacity border opacity-0 cursor-pointer group-hover:opacity-100 bg-background/25 rounded-xl gap-x-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="default"
                        size="icon"
                        onClick={() => uploadDialogRef.current?.open()}
                      >
                        <UploadIcon className="size-5!" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent align="center">Upload</TooltipContent>
                  </Tooltip>
                  {course.thumbnail && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="destructive" size="icon" asChild>
                          <Link
                            href={route("instructor.image.delete")}
                            method="delete"
                          >
                            <Trash2Icon className="size-5!" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent align="center">Remove</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </Avatar>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span
                  className={`flex items-center gap-1.5 text-[9px] font-black tracking-widest uppercase px-2.5 py-1 rounded-lg ${cfg.bg} ${cfg.color}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
                <span
                  className={`text-[9px] font-black tracking-widest uppercase px-2.5 py-1 rounded-lg capitalize ${levelCls}`}
                >
                  {course.level}
                </span>
                {course.categories?.map((category) => (
                  <span
                    key={category}
                    className="text-[9px] font-black tracking-widest uppercase px-2.5 py-1 rounded-lg bg-muted text-muted-foreground"
                  >
                    {category}
                  </span>
                ))}
              </div>
              <h1 className="text-xl font-black text-foreground uppercase tracking-tight leading-tight mb-2">
                {course.title}
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4 max-w-xl">
                {course.description}
              </p>
              <div className="flex items-center gap-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
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
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {course.total_hours}h - {course.total_sessions} Sessions
                </span>
                {course.certificate_type && (
                  <span className="flex items-center gap-1.5">
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
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {course.certificate_type}
                  </span>
                )}
                <span className="font-black text-primary">
                  {formatRp(course.price)}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-[10px] font-black tracking-widest uppercase bg-primary text-white rounded-xl hover:bg-primary-hover transition-all shadow-md shadow-primary/20"
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
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit Info
              </button>
              <button
                onClick={() =>
                  router.patch(
                    route("instructor.classes.togglePublish", course.id),
                  )
                }
                className={`flex items-center gap-2 px-5 py-2.5 text-[10px] font-black tracking-widest uppercase rounded-xl transition-all border-2 ${course.status === "published" ? "border-border text-muted-foreground hover:bg-muted" : "border-green-200 text-green-600 hover:bg-green-50"}`}
              >
                {course.status === "published" ? "Unpublish" : "Publish"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <CourseDetailStatCard
            label="Total Students"
            value={course.students_count ?? 0}
            accent="blue"
            icon={
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            }
          />
          <CourseDetailStatCard
            label="Sections"
            value={course.sections?.length ?? 0}
            accent="violet"
            icon={
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
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
            }
          />
          <CourseDetailStatCard
            label="Total Content"
            value={totalContents}
            accent="amber"
            icon={
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
          />
        </div>

        <div className="bg-card rounded-3xl border border-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xs font-black tracking-widest text-foreground uppercase">
              Sections & Content
            </h3>
            <button
              onClick={addSection}
              className="flex items-center gap-2 px-4 py-2 text-[9px] font-black tracking-widest uppercase bg-primary text-white rounded-xl hover:bg-primary-hover transition-all shadow-md shadow-primary/20"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Section
            </button>
          </div>
          <div className="space-y-3">
            {course.sections?.length > 0 ? (
              <Accordion
                type="single"
                collapsible
                value={openSectionValue}
                onValueChange={setOpenSectionValue}
                className="space-y-3"
              >
                {course.sections.map((section, index) => {
                  const sectionValue = `section-${section.id}`;

                  return (
                    <CourseDetailSectionBlock
                      key={section.id}
                      section={section}
                      index={index}
                      value={sectionValue}
                      isOpen={openSectionValue === sectionValue}
                      onDelete={deleteSection}
                    />
                  );
                })}
              </Accordion>
            ) : (
              <div className="py-12 flex flex-col items-center gap-3">
                <svg
                  className="w-10 h-10 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Belum ada section - tambah di atas
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showEditModal && (
        <CourseDetailEditModal
          course={course}
          categories={categories}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </MainLayout>
  );
}
