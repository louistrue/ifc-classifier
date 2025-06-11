import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SelectionState {
  selectedIds: string[];
  add: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
}

const LIMIT = 10000;

export const useSelectionStore = create<SelectionState>()(
  persist(
    (set, get) => ({
      selectedIds: [],
      add: (id: string) => {
        const current = get().selectedIds;
        if (current.includes(id)) {
          set({ selectedIds: current.filter((x) => x !== id) });
        } else {
          if (current.length >= LIMIT) {
            console.warn("Selection limit reached");
            return;
          }
          set({ selectedIds: [...current, id] });
        }
      },
      remove: (id: string) =>
        set({ selectedIds: get().selectedIds.filter((x) => x !== id) }),
      clear: () => set({ selectedIds: [] }),
      isSelected: (id: string) => get().selectedIds.includes(id),
    }),
    {
      name: "selection-store",
      storage: {
        getItem: (key) =>
          typeof sessionStorage !== "undefined" ? sessionStorage.getItem(key) : null,
        setItem: (key, value) => {
          if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key, value);
        },
        removeItem: (key) => {
          if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(key);
        },
      },
    }
  )
);
