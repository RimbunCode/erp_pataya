<?php

namespace App\Services\Finances\Ledger;

use App\Exceptions\Finances\InvalidJournalException;
use App\Exceptions\Finances\UnbalancedJournalException;
use App\Services\Finances\Currency\Decimal;
use InvalidArgumentException;
use RangeException;

/**
 * Validasi struktur dan keseimbangan draft jurnal tanpa akses database (Requirement 2.3-2.5): minimal 2 baris,
 * tidak ada nilai negatif, satu sisi per baris, pembulatan HALF_UP ke minor unit, lalu Σdebit = Σkredit pada
 * bilangan bulat minor unit. Dipisah dari `JournalService` agar invarian P-1 dapat diuji massal tanpa database.
 */
final class JournalDraftValidator {
    /**
     * @throws InvalidJournalException bila struktur draft tidak valid
     * @throws UnbalancedJournalException bila Σdebit ≠ Σkredit dalam minor unit
     */
    public static function validate(JournalDraft $draft, int $minorUnit): NormalizedJournal {
        $count = \count($draft->lines);
        if ($count < 2) {
            throw InvalidJournalException::tooFewLines($count);
        }

        $lines       = [];
        $totalDebit  = 0;
        $totalCredit = 0;
        $lineNo      = 0;

        foreach ($draft->lines as $line) {
            $lineNo++;

            $debit  = self::amount($line->debit, $lineNo);
            $credit = self::amount($line->credit, $lineNo);

            if ($debit < 0 || $credit < 0) {
                throw InvalidJournalException::negativeAmount($lineNo);
            }
            if ($debit > 0 && $credit > 0) {
                throw InvalidJournalException::bothSides($lineNo);
            }

            $debitMinor  = self::minor($line->debit, $minorUnit, $lineNo);
            $creditMinor = self::minor($line->credit, $minorUnit, $lineNo);
            if ($debitMinor === 0 && $creditMinor === 0) {
                throw InvalidJournalException::noAmount($lineNo);
            }

            if ($line->foreign !== null) {
                self::assertForeign($line->foreign, $debitMinor + $creditMinor, $minorUnit, $lineNo);
            }

            $totalDebit += $debitMinor;
            $totalCredit += $creditMinor;
            if (! \is_int($totalDebit) || ! \is_int($totalCredit)) {
                throw InvalidJournalException::amountOutOfRange($lineNo);
            }

            $lines[] = new NormalizedLine($line, $lineNo, $debitMinor, $creditMinor);
        }

        if ($totalDebit !== $totalCredit) {
            throw UnbalancedJournalException::make($totalDebit - $totalCredit, $minorUnit);
        }

        return new NormalizedJournal($lines, $totalDebit, $minorUnit);
    }

    /**
     * Requirement 3.4: nilai dasar baris = jumlah asing × kurs (HALF_UP ke minor unit) dalam toleransi satu minor unit.
     * Aritmetika `Decimal` (BigDecimal), tanpa float.
     */
    private static function assertForeign(ForeignAmount $foreign, int $baseMinor, int $minorUnit, int $lineNo): void {
        try {
            $amount = Decimal::normalize($foreign->amount);
            $rate   = Decimal::normalize($foreign->rate);
        } catch (InvalidArgumentException) {
            throw InvalidJournalException::foreignMismatch($lineNo);
        }

        if ($foreign->currencyCode === '' || Decimal::compare($amount, '0') <= 0 || Decimal::compare($rate, '0') <= 0) {
            throw InvalidJournalException::foreignMismatch($lineNo);
        }

        $expected      = Decimal::roundHalfUp(Decimal::multiply($amount, $rate), $minorUnit);
        $expectedMinor = MinorUnit::toMinor($expected, $minorUnit);
        if (abs($expectedMinor - $baseMinor) > 1) {
            throw InvalidJournalException::foreignMismatch($lineNo);
        }
    }

    private static function amount(float|int|string $value, int $lineNo): float {
        if (\is_string($value) && ! is_numeric($value)) {
            throw InvalidJournalException::nonNumericAmount($lineNo);
        }

        $number = (float) $value;
        if (! is_finite($number)) {
            throw InvalidJournalException::amountOutOfRange($lineNo);
        }

        return $number;
    }

    private static function minor(float|int|string $value, int $minorUnit, int $lineNo): int {
        try {
            return MinorUnit::toMinor($value, $minorUnit);
        } catch (RangeException) {
            throw InvalidJournalException::amountOutOfRange($lineNo);
        } catch (InvalidArgumentException) {
            throw InvalidJournalException::nonNumericAmount($lineNo);
        }
    }
}
