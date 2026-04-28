// resources/js/Pages/Guest/TrainingPreview.jsx

import { useState } from "react";
import GuestLayout from "@/Layouts/GuestLayout";

const course = {
  title: "Advanced Project Planning & Control (PPC)",
  tags: ["Online", "Advanced", "Management"],
  tagActive: "Advanced",
  description:
    "Master the arts of scheduling, cost estimation, and risk management using modern BIM tools and industrial standards. This comprehensive course will transform you into a proficient project planning professional.",
  rating: 4.9,
  reviews: 128,
  students: 2450,
  hours: 24,
  price: 2500000,
  duration: "24 Hours",
  sessions: "8 Sessions",
  language: "Bahasa Indonesia",
  certificate: "Professional",
  lastUpdated: "January 2026",
  image: "https://picsum.photos/seed/classroom/1200/500",
  whatYouLearn: [
    "Develop comprehensive project schedules using CPM and PERT techniques",
    "Master cost estimation and budget control methodologies",
    "Implement effective risk management frameworks",
    "Utilize BIM tools for 4D and 5D project planning",
    "Create professional project reports and presentations",
    "Lead project planning teams with confidence",
  ],
  requirements: [
    "Basic understanding of construction processes",
    "Experience in project coordination (preferred)",
    "Computer with stable internet connection",
    "Microsoft Project or Primavera P6 (trial version acceptable)",
  ],
  includes: [
    { icon: "video", label: "8 Live Sessions" },
    { icon: "file", label: "Downloadable Resources" },
    { icon: "badge", label: "Professional Certificate" },
    { icon: "globe", label: "Lifetime Access" },
  ],
  curriculum: [
    {
      id: 1,
      chapter: "Chapter 1",
      title: "Introduction to Project Planning",
      duration: "3h 20m",
      lessons: [
        {
          title: "Course Overview & Objectives",
          duration: "15m",
          type: "video",
        },
        { title: "Introduction to CPM", duration: "45m", type: "video" },
        {
          title: "PERT Technique Fundamentals",
          duration: "40m",
          type: "video",
        },
        { title: "Chapter Quiz", duration: "20m", type: "quiz" },
      ],
    },
    {
      id: 2,
      chapter: "Chapter 2",
      title: "Cost Estimation & Budget Control",
      duration: "4h 10m",
      lessons: [
        { title: "Cost Estimation Methods", duration: "50m", type: "video" },
        { title: "Budget Control Frameworks", duration: "55m", type: "video" },
        {
          title: "Case Study: Real Project Budget",
          duration: "1h 20m",
          type: "video",
        },
        {
          title: "Assignment: Budget Proposal",
          duration: "1h",
          type: "assignment",
        },
      ],
    },
    {
      id: 3,
      chapter: "Chapter 3",
      title: "Risk Management",
      duration: "3h 45m",
      lessons: [
        {
          title: "Risk Identification Techniques",
          duration: "45m",
          type: "video",
        },
        { title: "Risk Assessment Matrix", duration: "50m", type: "video" },
        { title: "Mitigation Planning", duration: "40m", type: "video" },
        { title: "Final Project", duration: "1h 30m", type: "assignment" },
      ],
    },
  ],
  instructor: {
    name: "Ir. Ahmad Sudirman",
    title: "Senior Project Management Consultant",
    bio: "With over 20 years of experience in construction project management, Ir. Ahmad Sudirman has led major infrastructure projects across Indonesia. He holds multiple international certifications in BIM and project management.",
    rating: 4.9,
    students: 8420,
    courses: 12,
    initial: "A",
  },
  reviews_list: [
    {
      name: "Budi Santoso",
      rating: 5,
      date: "Jan 2026",
      comment: "Excellent course! Very practical and well-structured.",
    },
    {
      name: "Siti Rahayu",
      rating: 4,
      date: "Dec 2025",
      comment: "Great content, instructor explains concepts clearly.",
    },
    {
      name: "Hendra W.",
      rating: 5,
      date: "Nov 2025",
      comment: "Best investment I've made for my career.",
    },
  ],
};

function formatRp(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function StarRating({ rating, size = "w-4 h-4" }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`${size} ${s <= Math.round(rating) ? "text-amber-400" : "text-gray-200"}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ))}
    </div>
  );
}

function LessonIcon({ type }) {
  if (type === "video")
    return (
      <svg
        className="w-4 h-4 text-blue-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    );
  if (type === "quiz")
    return (
      <svg
        className="w-4 h-4 text-purple-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    );
  return (
    <svg
      className="w-4 h-4 text-amber-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  );
}

function IncludeIcon({ type }) {
  const icons = {
    video: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
      />
    ),
    file: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    ),
    badge: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
      />
    ),
    globe: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  };
  return (
    <svg
      className="w-5 h-5 text-blue-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      {icons[type]}
    </svg>
  );
}

export default function TrainingPreview() {
  const [activeTab, setActiveTab] = useState("overview");
  const [openChapter, setOpenChapter] = useState(null);

  const tabs = ["overview", "curriculum", "instructor", "reviews"];

  return (
    <GuestLayout>
      <div className="min-h-screen bg-white">
        {/* ── Hero ── */}
        <div className="relative">
          <div className="absolute inset-0">
            <img
              src={course.image}
              alt={course.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 via-gray-900/70 to-gray-900/40" />
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-6 py-16">
            {/* Back */}
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 text-xs font-bold tracking-widest text-white/60 uppercase hover:text-white transition-colors mb-8"
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

            {/* Tags */}
            <div className="flex items-center gap-2 mb-5">
              {course.tags.map((tag) => (
                <span
                  key={tag}
                  className={`px-4 py-1.5 rounded-full text-xs font-extrabold tracking-widest uppercase transition-all
                    ${
                      tag === course.tagActive
                        ? "bg-blue-600 text-white"
                        : "bg-white/15 text-white/80 backdrop-blur-sm"
                    }`}
                >
                  {tag}
                </span>
              ))}
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight uppercase max-w-2xl mb-5">
              {course.title}
            </h1>
            <p className="text-base text-white/70 leading-relaxed max-w-2xl mb-8">
              {course.description}
            </p>

            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <StarRating rating={course.rating} />
                <span className="text-sm font-black text-amber-400">
                  {course.rating}
                </span>
                <span className="text-sm text-white/50">
                  ({course.reviews} reviews)
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-white/70">
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="font-semibold">
                  {course.students.toLocaleString()} students
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-white/70">
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="font-semibold">{course.hours} Hours</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sticky Tabs ── */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex items-center gap-0">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 text-xs font-extrabold tracking-widest uppercase border-b-2 transition-all duration-200
                    ${
                      activeTab === tab
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-3 gap-10">
            {/* Left — Tab Content */}
            <div className="col-span-2">
              {/* Overview */}
              {activeTab === "overview" && (
                <div className="flex flex-col gap-10">
                  {/* What you'll learn */}
                  <div>
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-6">
                      What You'll Learn
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                      {course.whatYouLearn.map((item) => (
                        <div
                          key={item}
                          className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl"
                        >
                          <svg
                            className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <p className="text-sm font-semibold text-gray-700 leading-snug">
                            {item}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Requirements */}
                  <div>
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-5">
                      Requirements
                    </h2>
                    <ul className="flex flex-col gap-3">
                      {course.requirements.map((req) => (
                        <li key={req} className="flex items-start gap-3">
                          <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-2" />
                          <span className="text-sm text-gray-600 leading-relaxed">
                            {req}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* This course includes */}
                  <div className="bg-gray-50 rounded-2xl p-6">
                    <h2 className="text-base font-black text-gray-900 uppercase tracking-tight mb-5">
                      This Course Includes:
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                      {course.includes.map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center gap-3"
                        >
                          <IncludeIcon type={item.icon} />
                          <span className="text-sm font-bold text-gray-700">
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Curriculum */}
              {activeTab === "curriculum" && (
                <div className="flex flex-col gap-4">
                  <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-2">
                    Course Curriculum
                  </h2>
                  {course.curriculum.map((chapter) => (
                    <div
                      key={chapter.id}
                      className={`border-2 rounded-2xl overflow-hidden transition-all duration-200
                        ${openChapter === chapter.id ? "border-blue-500" : "border-gray-100"}`}
                    >
                      {/* Chapter header */}
                      <button
                        onClick={() =>
                          setOpenChapter(
                            openChapter === chapter.id ? null : chapter.id,
                          )
                        }
                        className="w-full flex items-center gap-4 px-6 py-4 bg-white hover:bg-gray-50 transition-colors text-left"
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors
                          ${openChapter === chapter.id ? "bg-blue-600" : "bg-gray-100"}`}
                        >
                          <span
                            className={`text-xs font-black ${openChapter === chapter.id ? "text-white" : "text-gray-500"}`}
                          >
                            {String(chapter.id).padStart(2, "0")}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                            {chapter.chapter}
                          </p>
                          <p className="text-sm font-black text-gray-800 mt-0.5">
                            {chapter.title}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-gray-400 flex-shrink-0">
                          {chapter.duration}
                        </span>
                        <svg
                          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${openChapter === chapter.id ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {/* Lessons */}
                      {openChapter === chapter.id && (
                        <div className="border-t border-gray-100 bg-gray-50">
                          {chapter.lessons.map((lesson, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-4 px-6 py-3.5 border-b border-gray-100 last:border-none"
                            >
                              <LessonIcon type={lesson.type} />
                              <span className="flex-1 text-sm font-semibold text-gray-700">
                                {lesson.title}
                              </span>
                              <span className="text-xs font-bold text-gray-400">
                                {lesson.duration}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Instructor */}
              {activeTab === "instructor" && (
                <div className="flex flex-col gap-6">
                  <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                    Your Instructor
                  </h2>
                  <div className="flex items-start gap-5">
                    <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-3xl font-black flex-shrink-0">
                      {course.instructor.initial}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-gray-900">
                        {course.instructor.name}
                      </h3>
                      <p className="text-sm text-blue-600 font-semibold mt-0.5">
                        {course.instructor.title}
                      </p>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1.5">
                          <StarRating
                            rating={course.instructor.rating}
                            size="w-3.5 h-3.5"
                          />
                          <span className="text-xs font-bold text-gray-600">
                            {course.instructor.rating}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {course.instructor.students.toLocaleString()} students
                        </span>
                        <span className="text-xs text-gray-400">
                          {course.instructor.courses} courses
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {course.instructor.bio}
                  </p>
                </div>
              )}

              {/* Reviews */}
              {activeTab === "reviews" && (
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-6xl font-black text-gray-900">
                        {course.rating}
                      </p>
                      <StarRating rating={course.rating} size="w-5 h-5" />
                      <p className="text-xs text-gray-400 mt-1">
                        {course.reviews} reviews
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    {course.reviews_list.map((review, i) => (
                      <div key={i} className="bg-gray-50 rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-black">
                            {review.name.slice(0, 1)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800">
                              {review.name}
                            </p>
                            <div className="flex items-center gap-2">
                              <StarRating
                                rating={review.rating}
                                size="w-3 h-3"
                              />
                              <span className="text-[10px] text-gray-400">
                                {review.date}
                              </span>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {review.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right — Sticky Card */}
            <div className="col-span-1">
              <div className="sticky top-20">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
                  <div className="p-6">
                    <p className="text-3xl font-black text-gray-900">
                      {formatRp(course.price)}
                    </p>
                    <p className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mt-1">
                      One-Time Payment • Full Access
                    </p>

                    <div className="flex flex-col gap-3 mt-5">
                      <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold tracking-widest uppercase text-xs py-4 rounded-xl hover:-translate-y-0.5 shadow-md shadow-blue-200 transition-all duration-200">
                        Enroll Now
                      </button>
                      <button className="w-full border-2 border-gray-200 text-gray-600 font-extrabold tracking-widest uppercase text-xs py-3.5 rounded-xl hover:bg-gray-50 transition-colors">
                        Add to Wishlist
                      </button>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-5">
                      {[
                        { label: "Duration", value: course.duration },
                        { label: "Sessions", value: course.sessions },
                        { label: "Language", value: course.language },
                        { label: "Certificate", value: course.certificate },
                        { label: "Last Updated", value: course.lastUpdated },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between"
                        >
                          <span className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase">
                            {item.label}
                          </span>
                          <span className="text-sm font-black text-gray-700">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100">
                    {[
                      {
                        icon: (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                          />
                        ),
                        label: "Share",
                      },
                      {
                        icon: (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                          />
                        ),
                        label: "Save",
                      },
                      {
                        icon: (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                          />
                        ),
                        label: "Bookmark",
                      },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        className="flex flex-col items-center gap-1 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          {btn.icon}
                        </svg>
                        <span className="text-[9px] font-bold tracking-widest text-gray-400 uppercase">
                          {btn.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GuestLayout>
  );
}
