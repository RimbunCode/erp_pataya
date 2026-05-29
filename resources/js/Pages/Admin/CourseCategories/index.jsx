import MainLayout from "@/Layouts/MainLayout";
import { useForm, usePage } from "@inertiajs/react";

const formatDate = (dateValue) => {
  if (!dateValue) {
    return "-";
  }

  return new Date(dateValue).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function CourseCategoriesPage() {
  const { categories = [] } = usePage().props;
  const { data, setData, post, processing, errors, reset } = useForm({
    name: "",
  });

  const submit = (event) => {
    event.preventDefault();

    post(route("admin.course-categories.store"), {
      preserveScroll: true,
      onSuccess: () => reset("name"),
    });
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-3xl font-black text-[var(--foreground)] tracking-tight">
            COURSE CATEGORIES
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Kelola kategori course untuk kebutuhan katalog dan manajemen kelas.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-1 bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 h-fit">
            <h2 className="text-sm font-bold text-[var(--foreground)]">
              Tambah Kategori
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Hanya admin dengan permission course admin atau super admin.
            </p>

            <form className="mt-4 space-y-3" onSubmit={submit}>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1.5">
                  Nama Kategori
                </label>
                <input
                  type="text"
                  value={data.name}
                  onChange={(event) => setData("name", event.target.value)}
                  placeholder="Contoh: Digital Construction"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                {errors.name && (
                  <p className="text-[11px] text-red-600 mt-1">{errors.name}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={processing}
                className="w-full rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] py-2.5 text-xs font-semibold uppercase tracking-wider hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? "Menyimpan..." : "Tambah Kategori"}
              </button>
            </form>
          </div>

          <div className="xl:col-span-2 bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--foreground)]">
                Daftar Kategori
              </h2>
              <span className="text-xs text-[var(--muted-foreground)]">
                Total: {categories.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--secondary)]">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Name
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Slug
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Created At
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-5 py-10 text-center text-[var(--muted-foreground)]"
                      >
                        Belum ada kategori.
                      </td>
                    </tr>
                  ) : (
                    categories.map((category) => (
                      <tr
                        key={category.id}
                        className="border-t border-[var(--border)]"
                      >
                        <td className="px-5 py-3 font-medium text-[var(--foreground)]">
                          {category.name}
                        </td>
                        <td className="px-5 py-3 text-[var(--muted-foreground)]">
                          {category.slug}
                        </td>
                        <td className="px-5 py-3 text-[var(--muted-foreground)]">
                          {formatDate(category.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
