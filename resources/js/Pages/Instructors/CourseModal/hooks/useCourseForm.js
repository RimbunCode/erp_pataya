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
function buildSections(count) {
  const n = Number.parseInt(count, 10);
  if (!Number.isFinite(n) || n <= 0) return [];
  return Array.from({ length: n }, (_, i) => ({ title: `Session ${i + 1}` }));
}

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
    thumbnail: null,
    sections: buildSections(course?.total_sessions ?? ""),
  });

  const handleTotalSessionsChange = (value) => {
    setData((prev) => ({
      ...prev,
      total_sessions: value,
      sections: buildSections(value),
    }));
  };

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
      transform((currentData) => ({
        ...currentData,
        sections: buildSections(currentData.total_sessions),
      }));
      post(route("instructor.classes.store"), {
        onSuccess: onClose,
        preserveScroll: true,
        forceFormData: true,
        onFinish: () => transform((d) => d),
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
    isEdit,
    data,
    setData,
    processing,
    errors,
    isStep1Complete,
    DEFAULT_THUMBNAIL,
    thumbnailRef,
    thumbnailPreview,
    handleThumbnailChange,
    removeThumbnail,
    discountType,
    onDiscountTypeChange: handleDiscountTypeChange,
    discountPrefix: discountType === DISCOUNT_TYPES.percentage ? "%" : "Rp",
    handleTotalSessionsChange,
    handleSubmit,
  };
}
