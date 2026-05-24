import { useRef, useState } from "react";
import { useForm } from "@inertiajs/react";

const DEFAULT_THUMBNAIL = "/storage/images/logo-default.png";
const DISCOUNT_TYPES = {
  amount: "amount",
  percentage: "percentage",
};

/**
 * useCourseForm
 * @param {object|null} course  - Data course yang ada (mode edit), atau null (mode create)
 * @param {function}    onClose - Callback setelah modal ditutup / berhasil submit
 */
export function useCourseForm(course = null, onClose) {
  const isEdit = !!course;

  // â”€â”€ Thumbnail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const thumbnailRef = useRef();

  // Mode edit: tampilkan thumbnail existing sebagai preview awal.
  // Preview hanya diganti kalau user upload file baru atau klik hapus.
  // Perbaiki di useCourseForm.js
  const existingThumbnailUrl = course?.thumbnail
    ? route("files.preview", course.thumbnail)
    : null;

  const [thumbnailPreview, setThumbnailPreview] =
    useState(existingThumbnailUrl);
  const [discountType, setDiscountType] = useState(
    course?.discount_type ?? DISCOUNT_TYPES.amount,
  );

  // "thumbnail" di form state:
  //   - null          â†’ tidak ada perubahan (mode edit: backend skip field ini)
  //   - File object   â†’ file baru yang akan diupload
  //   - "delete"      â†’ signal hapus thumbnail (mode edit)
  const { data, setData, processing, errors, post, transform } = useForm({
    title: course?.title ?? "",
    description: course?.description ?? "",
    price: course?.price ?? "",
    discount_type: course?.discount_type ?? DISCOUNT_TYPES.amount,
    discount: course?.discount ?? "",
    level: course?.level ?? "",
    category: course?.categories?.[0] ?? "",
    total_hours: course?.total_hours ?? "",
    total_sessions: course?.total_sessions ?? "",
    certificate_type: course?.certificate_type ?? "",
    thumbnail: null, // null = tidak berubah; diisi File jika user upload baru
  });

  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setData("thumbnail", file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const handleDiscountTypeChange = (value) => {
    setDiscountType(value);
    setData("discount_type", value);
  };

  const removeThumbnail = () => {
    // Mode edit: kirim signal "delete" ke backend agar thumbnail lama dihapus.
    // Mode create: cukup null saja.
    setData("thumbnail", isEdit ? "delete" : null);
    setThumbnailPreview(null);
    if (thumbnailRef.current) thumbnailRef.current.value = "";
  };

  // â”€â”€ Step â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [step, setStep] = useState(1);

  // â”€â”€ Sections (hanya dipakai mode create) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [sections, setSections] = useState([]);

  const goToStep2 = () => {
    const count = Number.parseInt(data.total_sessions, 10);

    if (!Number.isFinite(count) || count <= 0) {
      setSections([]);
      setStep(2);
      return;
    }

    setSections(
      Array.from({ length: count }, (_, i) => ({
        id: Date.now() + i,
        title: `Section ${i + 1}`,
        contents: [],
      })),
    );
    setStep(2);
  };

  // â”€â”€ Section helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addSection = () =>
    setSections((p) => [...p, { id: Date.now(), title: "", contents: [] }]);

  const removeSection = (id) =>
    setSections((p) => p.filter((s) => s.id !== id));

  const updateSection = (id, value) =>
    setSections((p) =>
      p.map((s) => (s.id === id ? { ...s, title: value } : s)),
    );

  const addContent = (sid) =>
    setSections((p) =>
      p.map((s) =>
        s.id === sid
          ? {
              ...s,
              contents: [
                ...s.contents,
                { id: Date.now(), title: "", type: "material" },
              ],
            }
          : s,
      ),
    );

  const removeContent = (sid, cid) =>
    setSections((p) =>
      p.map((s) =>
        s.id === sid
          ? { ...s, contents: s.contents.filter((c) => c.id !== cid) }
          : s,
      ),
    );

  const updateContent = (sid, cid, field, value) =>
    setSections((p) =>
      p.map((s) =>
        s.id === sid
          ? {
              ...s,
              contents: s.contents.map((c) =>
                c.id === cid ? { ...c, [field]: value } : c,
              ),
            }
          : s,
      ),
    );

  const handleSubmit = () => {
    if (isEdit) {
      // Submit via useForm agar errors & processing tersinkron otomatis.
      transform((currentData) => {
        const { thumbnail, ...rest } = currentData;

        return {
          ...rest,
          _method: "PATCH",
          ...(thumbnail !== null ? { thumbnail } : {}),
        };
      });

      post(route("instructor.classes.update", course.id), {
        onSuccess: onClose,
        preserveScroll: true,
        onFinish: () => transform((currentData) => currentData),
      });
    } else {
      // Mode create: POST dengan sections.
      const cleanedSections = sections.map(({ title, contents }) => ({
        title,
        contents: contents.map(({ title, type }) => ({ title, type })),
      }));

      transform((currentData) => ({
        ...currentData,
        sections: cleanedSections,
      }));

      post(route("instructor.classes.store"), {
        onSuccess: onClose,
        preserveScroll: true,
        forceFormData: true,
        onFinish: () => transform((currentData) => currentData),
      });
    }
  };

  // â”€â”€ Validasi step 1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const isStep1Complete =
    data.title.trim() &&
    data.description.trim() &&
    data.price &&
    data.level &&
    data.category;
  return {
    // mode
    isEdit,
    // form
    data,
    setData,
    processing,
    errors,
    // step
    step,
    setStep,
    goToStep2,
    isStep1Complete,
    // thumbnail
    DEFAULT_THUMBNAIL,
    thumbnailRef,
    thumbnailPreview,
    handleThumbnailChange,
    removeThumbnail,
    discountType,
    onDiscountTypeChange: handleDiscountTypeChange,
    discountPrefix: discountType === DISCOUNT_TYPES.percentage ? "%" : "Rp",
    // sections
    sections,
    addSection,
    removeSection,
    updateSection,
    addContent,
    removeContent,
    updateContent,
    // submit
    handleSubmit,
  };
}
