import { useEffect } from "react";
import { useSelectionStore } from "@/store/selection";

export function useKeyboardShortcuts(getVisibleIds?: () => string[]) {
  const { add, clear, selectedIds } = useSelectionStore();

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clear();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (e.shiftKey) {
          // invert selection
          const visible = getVisibleIds ? getVisibleIds() : [];
          const newSelection = visible.filter((id) => !selectedIds.includes(id));
          clear();
          newSelection.forEach((id) => add(id));
        } else {
          const all = getVisibleIds ? getVisibleIds() : [];
          clear();
          all.forEach((id) => add(id));
        }
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [add, clear, selectedIds, getVisibleIds]);
}
