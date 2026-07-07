import MainLayout from "@/Layouts/MainLayout";
import { Link, usePage } from "@inertiajs/react";

export default function EnrollmentEvaluationsIndex() {
  const { courses = [] } = usePage().props;

  return (
    <MainLayout title="Review Evaluasi Sertifikat">
      <div className="p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">
            Review Evaluasi Sertifikat
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Course dengan evaluasi yang menunggu approval final.
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 border-b border-border text-left">
                <th className="px-6 py-3 text-[10px] font-black tracking-widest text-muted-foreground uppercase">Course</th>
                <th className="px-6 py-3 text-[10px] font-black tracking-widest text-muted-foreground uppercase">Menunggu Approval</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id} className="border-b border-border last:border-0">
                  <td className="px-6 py-3 font-bold text-foreground">{course.title}</td>
                  <td className="px-6 py-3">{course.pendingCount}</td>
                  <td className="px-6 py-3 text-right">
                    <Link
                      href={route("admin.enrollment-evaluations.show", course.id)}
                      className="text-xs font-black uppercase text-primary hover:underline"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
              {courses.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-muted-foreground text-xs uppercase font-bold">
                    Tidak ada evaluasi yang menunggu approval.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}
