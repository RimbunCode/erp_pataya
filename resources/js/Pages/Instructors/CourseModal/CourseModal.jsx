import { useCourseForm } from "./hooks/useCourseForm";
import ModalHeader from "./ModalHeader";
import Step1Form from "./Step1Form";
import ModalActions from "./ModalActions";

/**
 * CourseModal — Modal reusable untuk Create dan Edit course.
 *
 * Props:
 *   categories {array}         - Daftar kategori { id, slug, name }
 *   onClose    {function}      - Callback tutup modal
 *   course     {object|null}   - Data course untuk mode edit; undefined/null = mode create
 *
 * Penggunaan:
 *   // Create
 *   <CourseModal categories={categories} onClose={() => setShow(false)} />
 *
 *   // Edit
 *   <CourseModal course={course} categories={categories} onClose={() => setShowEdit(false)} />
 * @param root0
 * @param root0.categories
 * @param root0.onClose
 * @param root0.course
 */
export default function CourseModal({
  categories = [],
  onClose,
  course = null,
}) {
  const {
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
    onDiscountTypeChange,
    discountPrefix,
    handleTotalSessionsChange,
    handleSubmit,
  } = useCourseForm(course, onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="bg-card rounded-3xl shadow-2xl w-full max-w-2xl relative overflow-hidden max-h-[90vh] flex flex-col">
        {/* Accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary to-indigo-500 flex-shrink-0" />

        {/* Header */}
        <ModalHeader isEdit={isEdit} onClose={onClose} />

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-8 pb-8">
          <Step1Form
            data={data}
            setData={setData}
            errors={errors}
            categories={categories}
            thumbnailRef={thumbnailRef}
            thumbnailPreview={thumbnailPreview}
            hasThumbnail={
              thumbnailPreview !== null ||
              (isEdit && !!course.thumbnail && data.thumbnail !== "delete")
            }
            discountType={discountType}
            onDiscountTypeChange={onDiscountTypeChange}
            discountPrefix={discountPrefix}
            DEFAULT_THUMBNAIL={DEFAULT_THUMBNAIL}
            onThumbnailChange={handleThumbnailChange}
            onRemoveThumbnail={removeThumbnail}
            onTotalSessionsChange={!isEdit ? handleTotalSessionsChange : null}
            sections={!isEdit ? data.sections : null}
          />

          {/* Actions */}
          <ModalActions
            isEdit={isEdit}
            isStep1Complete={isStep1Complete}
            processing={processing}
            onClose={onClose}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
}
