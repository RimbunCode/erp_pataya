import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  PaginationButton,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  Pagination as PaginationUi,
} from "../ui/pagination";

import { cn } from "@/lib/utils";

function condensePages(totalPages, currentPage, changePage) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const maxAdjacent = 2; // Jumlah halaman yang ditampilkan di sekitar awal, akhir, dan elemen yang dipilih

  const result = [];
  let previousPage = null;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    // Tampilkan halaman jika di awal, akhir, atau dalam jarak tertentu dari halaman yang dipilih
    if (
      i < maxAdjacent || // Halaman awal
      i > pages.length - maxAdjacent - 1 || // Halaman akhir
      Math.abs(page - currentPage) <= (maxAdjacent < 2 ? 1 : maxAdjacent - 1) // Halaman di sekitar yang dipilih
    ) {
      if (previousPage !== null && page !== previousPage + 1) {
        result.push(
          <PaginationItem key={`ellipsis-${page}`}>
            <PaginationEllipsis />
          </PaginationItem>,
        ); // Tambahkan ellipsis jika ada jarak antara halaman
      }
      result.push(
        <PaginationItem key={page}>
          <PaginationButton
            onClick={() => changePage(page)}
            isActive={page === currentPage}
          >
            {page}
          </PaginationButton>
        </PaginationItem>,
      );
      previousPage = page;
    }
  }

  return result;
}

function Pagination({ currentPage = 1, totalPages, onPageChanged, ...props }) {
  if (!totalPages || totalPages <= 1) {
    return null;
  }
  const changePage = (page) => {
    if (onPageChanged) onPageChanged(page);
  };
  return (
    <PaginationUi {...props}>
      <PaginationContent>
        {currentPage > 1 && (
          <PaginationItem>
            <PaginationButton
              aria-label="Go to previous page"
              size="default"
              className={cn("gap-1 pl-2.5")}
              onClick={() => changePage(currentPage - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </PaginationButton>
          </PaginationItem>
        )}
        {condensePages(totalPages, currentPage, changePage)}
        {currentPage < totalPages && (
          <PaginationItem>
            <PaginationButton
              aria-label="Go to next page"
              size="default"
              className={cn("gap-1 pr-2.5")}
              onClick={() => changePage(currentPage + 1)}
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </PaginationButton>
          </PaginationItem>
        )}
      </PaginationContent>
    </PaginationUi>
  );
}

export default Pagination;
