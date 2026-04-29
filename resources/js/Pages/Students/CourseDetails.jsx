// resources/js/Pages/Student/TrainingDetail.jsx

import { useState } from "react";
import MainLayout from "@/Layouts/MainLayout";

const course = {
  title: "Advanced Project Planning & Control (PPC)",
  instructor: "Ir. Ahmad Sudirman",
  progress: 35,
  image: "https://picsum.photos/seed/classroom/1200/500",
  announcements: [
    {
      id: 1,
      type: "schedule",
      message:
        "Live session on Chapter 2 has been moved to Friday, 15 Feb 2026 at 19:00 WIB.",
      date: "2 hours ago",
      urgent: true,
    },
    {
      id: 2,
      type: "material",
      message:
        "New supplementary material has been added to Chapter 1 — please download before the next session.",
      date: "Yesterday",
      urgent: false,
    },
  ],
  chapters: [
    {
      id: 1,
      title: "Introduction to Project Planning",
      status: "completed",
      cards: [
        {
          type: "pre_assessment",
          title: "Pre Assessment",
          optional: true,
          description:
            "Complete this assessment to help us understand your current knowledge level. This is optional but recommended.",
          questions_file: "pre_assessment_chapter1.pdf",
          submitted: false,
        },
        {
          type: "material",
          title: "Chapter Materials",
          description:
            "Study the following materials before attending the live session.",
          topics: [
            {
              title: "Introduction to CPM (Critical Path Method)",
              file: "material_cpm.pdf",
            },
            { title: "PERT Technique Fundamentals", file: "material_pert.pdf" },
            {
              title: "Project Scheduling Basics",
              file: "material_scheduling.pdf",
            },
          ],
        },
        {
          type: "assignment",
          title: "Chapter Assignment",
          description:
            "Create a simple project schedule using CPM for a hypothetical construction project with at least 10 activities.",
          deadline: "20 Feb 2026, 23:59 WIB",
          submitted: true,
          submitted_file: "my_assignment_ch1.pdf",
        },
      ],
    },
    {
      id: 2,
      title: "Cost Estimation & Budget Control",
      status: "in_progress",
      cards: [
        {
          type: "material",
          title: "Chapter Materials",
          description:
            "Study the following materials before attending the live session.",
          topics: [
            {
              title: "Cost Estimation Methods",
              file: "material_cost_estimation.pdf",
            },
            {
              title: "Budget Control Frameworks",
              file: "material_budget_control.pdf",
            },
          ],
        },
        {
          type: "assignment",
          title: "Chapter Assignment",
          description:
            "Develop a complete budget plan for a given project scenario. Include cost estimation, contingency plan, and cash flow projection.",
          deadline: "28 Feb 2026, 23:59 WIB",
          submitted: false,
        },
      ],
    },
    {
      id: 3,
      title: "Risk Management",
      status: "locked",
      cards: [
        {
          type: "material",
          title: "Chapter Materials",
          description:
            "Materials will be available after completing Chapter 2.",
          topics: [],
        },
        {
          type: "assignment",
          title: "Chapter Assignment",
          description:
            "Assignment details will be released after completing Chapter 2.",
          deadline: null,
          submitted: false,
        },
      ],
    },
  ],
};

function UploadModal({ onClose, title }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 to-indigo-500" />
        <div className="p-8">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-gray-300 hover:text-gray-500 transition-colors"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-700 uppercase tracking-tight">
                Submit Answer
              </h3>
              <p className="text-xs text-gray-400">{title}</p>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const dropped = e.dataTransfer.files[0];
              if (dropped) setFile(dropped);
            }}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer
              ${dragging ? "border-blue-500 bg-blue-50" : file ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-blue-400 hover:bg-blue-50"}`}
            onClick={() => document.getElementById("file-upload").click()}
          >
            <input
              id="file-upload"
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.zip"
              onChange={(e) => setFile(e.target.files[0])}
            />
            {file ? (
              <>
                <svg
                  className="w-10 h-10 text-green-500 mx-auto mb-3"
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
                <p className="text-sm font-bold text-green-600">{file.name}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </>
            ) : (
              <>
                <svg
                  className="w-10 h-10 text-gray-300 mx-auto mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                <p className="text-sm font-bold text-gray-500">
                  Drop your file here or click to browse
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  PDF, DOC, DOCX, ZIP — Max 20MB
                </p>
              </>
            )}
          </div>

          {file && (
            <button
              onClick={() => setFile(null)}
              className="mt-2 text-xs font-bold text-red-400 hover:text-red-500 transition-colors"
            >
              Remove file
            </button>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 text-xs font-extrabold tracking-widest text-gray-400 uppercase border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!file}
              className={`flex-1 px-4 py-3 text-xs font-extrabold tracking-widest uppercase rounded-xl transition-all duration-200
                ${
                  file
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:-translate-y-0.5"
                    : "bg-gray-100 text-gray-300 cursor-not-allowed"
                }`}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChapterCard({ chapter }) {
  const [open, setOpen] = useState(chapter.status === "in_progress");
  const [openCard, setOpenCard] = useState(null);
  const [uploadTarget, setUploadTarget] = useState(null);

  const isLocked = chapter.status === "locked";

  const statusConfig = {
    completed: {
      label: "Completed",
      color: "text-green-600",
      bg: "bg-green-50",
      dot: "bg-green-500",
    },
    in_progress: {
      label: "In Progress",
      color: "text-blue-600",
      bg: "bg-blue-50",
      dot: "bg-blue-500",
    },
    locked: {
      label: "Locked",
      color: "text-gray-400",
      bg: "bg-gray-100",
      dot: "bg-gray-300",
    },
  };
  const config = statusConfig[chapter.status];

  return (
    <>
      <div
        className={`border-2 rounded-2xl overflow-hidden transition-all duration-200
        ${open && !isLocked ? "border-blue-500 shadow-md shadow-blue-50" : "border-gray-100"}`}
      >
        {/* Chapter header */}
        <button
          onClick={() => !isLocked && setOpen((v) => !v)}
          className={`w-full flex items-center gap-4 px-6 py-5 text-left transition-colors
            ${isLocked ? "cursor-not-allowed opacity-60" : "hover:bg-gray-50"}`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${open ? "bg-blue-600" : "bg-gray-100"}`}
          >
            {isLocked ? (
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            ) : (
              <span
                className={`text-xs font-black ${open ? "text-white" : "text-gray-500"}`}
              >
                {String(chapter.id).padStart(2, "0")}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
              Chapter {chapter.id}
            </p>
            <p className="text-sm font-black text-gray-800 mt-0.5">
              {chapter.title}
            </p>
          </div>

          <span
            className={`flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest uppercase px-3 py-1.5 rounded-xl flex-shrink-0 ${config.bg} ${config.color}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label}
          </span>

          {!isLocked && (
            <svg
              className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
          )}
        </button>

        {/* Inner cards */}
        {open && !isLocked && (
          <div className="border-t border-gray-100 bg-gray-50 p-4 flex flex-col gap-3">
            {chapter.cards.map((card, i) => (
              <div
                key={i}
                className={`bg-white rounded-xl border-2 overflow-hidden transition-all duration-200
                  ${openCard === i ? "border-blue-400" : "border-gray-100"}`}
              >
                {/* Card header */}
                <button
                  onClick={() => setOpenCard(openCard === i ? null : i)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  {/* Card type icon */}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                    ${
                      card.type === "pre_assessment"
                        ? "bg-purple-100"
                        : card.type === "material"
                          ? "bg-blue-100"
                          : "bg-amber-100"
                    }`}
                  >
                    {card.type === "pre_assessment" && (
                      <svg
                        className="w-4 h-4 text-purple-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        />
                      </svg>
                    )}
                    {card.type === "material" && (
                      <svg
                        className="w-4 h-4 text-blue-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                    )}
                    {card.type === "assignment" && (
                      <svg
                        className="w-4 h-4 text-amber-600"
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
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-gray-800">
                        {card.title}
                      </p>
                      {card.optional && (
                        <span className="text-[9px] font-extrabold tracking-widest uppercase px-2 py-0.5 bg-purple-100 text-purple-600 rounded-lg">
                          Optional
                        </span>
                      )}
                      {card.submitted && (
                        <span className="text-[9px] font-extrabold tracking-widest uppercase px-2 py-0.5 bg-green-100 text-green-600 rounded-lg">
                          Submitted
                        </span>
                      )}
                    </div>
                  </div>

                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${openCard === i ? "rotate-180" : ""}`}
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

                {/* Card content */}
                {openCard === i && (
                  <div className="border-t border-gray-100 px-5 py-4 flex flex-col gap-4">
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {card.description}
                    </p>

                    {/* Pre Assessment */}
                    {card.type === "pre_assessment" && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <button className="flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold tracking-widest uppercase bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors">
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
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                          Download Questions
                        </button>
                        <button
                          onClick={() => setUploadTarget(card.title)}
                          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold tracking-widest uppercase rounded-xl transition-all duration-200
                            ${
                              card.submitted
                                ? "bg-green-50 text-green-600 border border-green-200"
                                : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:-translate-y-0.5"
                            }`}
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
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                            />
                          </svg>
                          {card.submitted
                            ? "Re-submit Answer"
                            : "Submit Answer"}
                        </button>
                      </div>
                    )}

                    {/* Material */}
                    {card.type === "material" && card.topics.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {card.topics.map((topic, j) => (
                          <div
                            key={j}
                            className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors cursor-pointer"
                          >
                            <svg
                              className="w-4 h-4 text-blue-500 flex-shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            </svg>
                            <span className="flex-1 text-sm font-semibold text-blue-700">
                              {topic.title}
                            </span>
                            <svg
                              className="w-4 h-4 text-blue-400 flex-shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                              />
                            </svg>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Assignment */}
                    {card.type === "assignment" && (
                      <div className="flex flex-col gap-3">
                        {card.deadline && (
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                            <svg
                              className="w-4 h-4 text-amber-500 flex-shrink-0"
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
                            <span className="text-xs font-bold text-amber-600">
                              Deadline: {card.deadline}
                            </span>
                          </div>
                        )}

                        {card.submitted && (
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-100 rounded-xl">
                            <svg
                              className="w-4 h-4 text-green-500 flex-shrink-0"
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
                            <span className="text-xs font-bold text-green-600">
                              Submitted: {card.submitted_file}
                            </span>
                          </div>
                        )}

                        <button
                          onClick={() => setUploadTarget(card.title)}
                          className={`flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-extrabold tracking-widest uppercase rounded-xl transition-all duration-200 w-fit
                            ${
                              card.submitted
                                ? "bg-gray-100 hover:bg-gray-200 text-gray-600"
                                : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:-translate-y-0.5"
                            }`}
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
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                            />
                          </svg>
                          {card.submitted ? "Re-submit" : "Submit Assignment"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {uploadTarget && (
        <UploadModal
          title={uploadTarget}
          onClose={() => setUploadTarget(null)}
        />
      )}
    </>
  );
}

export default function CourseDetails() {
  return (
    <MainLayout title="Training Detail" breadcrumb="My Learning">
      <div className="p-8 flex flex-col gap-6">
        {/* ── Course Header ── */}
        <div className="relative rounded-3xl overflow-hidden h-48">
          <img
            src={course.image}
            alt={course.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-900/85 to-gray-900/40" />
          <div className="absolute inset-0 p-7 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[2px] text-white/50 uppercase mb-1">
                {course.instructor}
              </p>
              <h2 className="text-xl font-black text-white uppercase tracking-tight max-w-lg leading-tight">
                {course.title}
              </h2>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] font-bold tracking-widest text-white/50 uppercase mb-1">
                Your Progress
              </p>
              <p className="text-3xl font-black text-white">
                {course.progress}%
              </p>
              <div className="w-32 h-1.5 bg-white/20 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full"
                  style={{ width: `${course.progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Announcements ── */}
        {course.announcements.length > 0 && (
          <div className="flex flex-col gap-3">
            {course.announcements.map((a) => (
              <div
                key={a.id}
                className={`flex items-start gap-4 px-5 py-4 rounded-2xl border
                  ${a.urgent ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-100"}`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                  ${a.urgent ? "bg-amber-100" : "bg-blue-100"}`}
                >
                  {a.type === "schedule" ? (
                    <svg
                      className={`w-5 h-5 ${a.urgent ? "text-amber-600" : "text-blue-600"}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className={`w-5 h-5 ${a.urgent ? "text-amber-600" : "text-blue-600"}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p
                      className={`text-[10px] font-extrabold tracking-widest uppercase ${a.urgent ? "text-amber-600" : "text-blue-600"}`}
                    >
                      {a.type === "schedule"
                        ? "Schedule Update"
                        : "New Material"}{" "}
                      — from Instructor
                    </p>
                    {a.urgent && (
                      <span className="text-[9px] font-extrabold tracking-widest uppercase px-2 py-0.5 bg-amber-200 text-amber-700 rounded-lg">
                        Important
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {a.message}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">{a.date}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Chapters ── */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">
            Course Content
          </h3>
          {course.chapters.map((chapter) => (
            <ChapterCard key={chapter.id} chapter={chapter} />
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
