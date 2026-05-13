import { useCourseForm } from "./hooks/useCourseForm";
import ModalHeader from "./ModalHeader";
import Step1Form from "./Step1Form";
import Step2Sections from "./Step2Sections";
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
    step,
    setStep,
    goToStep2,
    isStep1Complete,
    DEFAULT_THUMBNAIL,
    thumbnailRef,
    thumbnailPreview,
    handleThumbnailChange,
    removeThumbnail,
    sections,
    addSection,
    removeSection,
    updateSection,
    addContent,
    removeContent,
    updateContent,
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

        {/* Header + step indicator */}
        <ModalHeader isEdit={isEdit} step={step} onClose={onClose} />

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-8 pb-8">
          {/* Step 1 — selalu tampil di mode edit; tampil di step 1 mode create */}
          {(isEdit || step === 1) && (
            <Step1Form
              data={data}
              setData={setData}
              errors={errors}
              categories={categories}
              thumbnailRef={thumbnailRef}
              thumbnailPreview={thumbnailPreview}
              // Ada thumbnail jika: preview baru ada, ATAU mode edit masih pakai existing
              // (belum dihapus, ditandai dengan data.thumbnail !== "delete")
              hasThumbnail={
                thumbnailPreview !== null ||
                (isEdit && !!course.thumbnail && data.thumbnail !== "delete")
              }
              DEFAULT_THUMBNAIL={DEFAULT_THUMBNAIL}
              onThumbnailChange={handleThumbnailChange}
              onRemoveThumbnail={removeThumbnail}
            />
          )}

          {/* Step 2 — hanya mode create */}
          {!isEdit && step === 2 && (
            <Step2Sections
              sections={sections}
              onAddSection={addSection}
              onRemoveSection={removeSection}
              onUpdateSection={updateSection}
              onAddContent={addContent}
              onRemoveContent={removeContent}
              onUpdateContent={updateContent}
            />
          )}

          {/* Actions */}
          <ModalActions
            isEdit={isEdit}
            step={step}
            isStep1Complete={isStep1Complete}
            processing={processing}
            onClose={onClose}
            onBack={() => setStep(1)}
            onNext={goToStep2}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
}
