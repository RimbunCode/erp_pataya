<?php

namespace App\Services;

use App\Models\Enrollment;
use App\Models\EnrollmentEvaluation;
use App\Models\Submission;

class GradingService {
    public function __construct(private CertificateService $certificateService) {
    }

    public function computeFinalScore(Enrollment $enrollment): ?float {
        $enrollment->load('course.sections.contents');

        $gradedContentIds = $enrollment->course->sections
            ->flatMap(fn ($s) => $s->contents)
            ->where('is_optional', false)
            ->filter(fn ($content) => $content->isSubmissionType())
            ->pluck('id');

        if ($gradedContentIds->isEmpty()) {
            return null;
        }

        $grades = Submission::where('user_id', $enrollment->user_id)
            ->whereIn('content_id', $gradedContentIds)
            ->pluck('grade', 'content_id');

        $hasUngraded = $gradedContentIds->contains(fn ($id) => is_null($grades->get($id)));

        if ($hasUngraded) {
            return null;
        }

        return round($grades->avg(), 2);
    }

    public function scoreToGrade(float $score): string {
        return match (true) {
            $score >= 86 => 'A',
            $score >= 75 => 'B',
            $score >= 61 => 'C',
            $score >= 50 => 'D',
            default      => 'E',
        };
    }

    public function evaluate(Enrollment $enrollment): array {
        $enrollment->loadMissing('course');

        if ($enrollment->course->graduation_scheme === 'assignment') {
            $finalScore = $this->computeFinalScore($enrollment);

            return [
                'final_score' => $finalScore,
                'grade'       => $finalScore !== null ? $this->scoreToGrade($finalScore) : null,
                'is_passed'   => $finalScore !== null && $finalScore >= $enrollment->course->min_passing_score,
            ];
        }

        return [
            'final_score' => null,
            'grade'       => null,
            'is_passed'   => $this->certificateService->isCourseCompleted($enrollment),
        ];
    }

    /**
     * Peserta dianggap "selesai dievaluasi" (boleh disubmit instruktur) jika:
     * - skema assignment: seluruh tugas wajib sudah dinilai (computeFinalScore tidak null).
     * - skema attendance: selalu true, karena isCourseCompleted() sudah representasi
     *   status final (tidak ada state "menunggu dinilai" di skema ini).
     */
    public function isFullyEvaluated(Enrollment $enrollment): bool {
        $enrollment->loadMissing('course');

        if ($enrollment->course->graduation_scheme === 'assignment') {
            return $this->computeFinalScore($enrollment) !== null;
        }

        return true;
    }

    public function syncEvaluation(Enrollment $enrollment): EnrollmentEvaluation {
        $result = $this->evaluate($enrollment);

        $evaluation = EnrollmentEvaluation::firstOrNew(['enrollment_id' => $enrollment->id]);
        $evaluation->fill($result);

        if (! $evaluation->exists) {
            $evaluation->status = 'draft';
        }

        $evaluation->save();

        return $evaluation;
    }
}
