import React, { useState, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
}

export function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      suggestions.filter((s) =>
        s.toLowerCase().includes(value.toLowerCase())
      ),
    [suggestions, value]
  );

  return (
    <div className="relative" ref={containerRef}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        placeholder={placeholder}
        className={cn("w-full", className)}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
          {filtered.map((s) => (
            <li
              key={s}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              className="cursor-pointer px-2 py-1 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
