import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const PaginationControls = ({ currentPage, totalItems, pageSize, onPageChange }: PaginationControlsProps) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
      >
        <ChevronLeft className="h-3.5 w-3.5 sm:mr-1" />
        <span className="hidden sm:inline">Previous</span>
      </Button>
      <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
        {currentPage} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="h-3.5 w-3.5 sm:ml-1" />
      </Button>
    </div>
  );
};
