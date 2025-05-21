"use client";

import * as React from "react";
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface ComboboxOption {
  value: string;
  label: string;
  [key: string]: any; // Allow additional properties
}

interface CreatableComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyResultText?: string;
  createText?: (value: string) => string;
  className?: string;
  popoverClassName?: string;
  renderOption?: (option: ComboboxOption) => React.ReactNode;
}

export function CreatableCombobox({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Search or create...",
  emptyResultText = "No results found.",
  createText = (searchValue) => `Create "${searchValue}"`,
  className,
  popoverClassName,
  renderOption,
}: CreatableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [selectedOption, setSelectedOption] =
    React.useState<ComboboxOption | null>(() => {
      const initialOption = options.find((option) => option.value === value);
      if (initialOption) {
        return initialOption;
      }
      if (value) {
        return { value: value, label: value };
      }
      return null;
    });

  // Focus input when dropdown opens
  React.useEffect(() => {
    if (open && inputRef.current) {
      // Short timeout to ensure DOM has updated
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  }, [open]);

  React.useEffect(() => {
    const foundOption = options.find((option) => option.value === value);
    if (foundOption) {
      setSelectedOption(foundOption);
    } else if (value) {
      setSelectedOption({ value: value, label: value });
    } else {
      setSelectedOption(null);
    }
  }, [value, options]);

  const handleSelectOption = (currentValue: string) => {
    const option = options.find(
      (opt) => opt.value.toLowerCase() === currentValue.toLowerCase()
    );
    if (option) {
      onChange(option.value);
      setSelectedOption(option);
      setInputValue("");
    } else {
      onChange(currentValue);
      setSelectedOption({ value: currentValue, label: currentValue });
      setInputValue("");
    }
    setOpen(false);
  };

  const filteredOptions = React.useMemo(() => {
    if (!inputValue) {
      return options;
    }
    return options.filter((option) =>
      option.label.toLowerCase().includes(inputValue.toLowerCase())
    );
  }, [options, inputValue]);

  const showCreateOption =
    inputValue &&
    !filteredOptions.some(
      (option) => option.label.toLowerCase() === inputValue.toLowerCase()
    ) &&
    !options.some(
      (option) => option.value.toLowerCase() === inputValue.toLowerCase()
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selectedOption ? (
            renderOption ? (
              <div className="overflow-hidden text-ellipsis text-left flex-1">
                {renderOption(selectedOption)}
              </div>
            ) : (
              selectedOption.label
            )
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <div className={cn(open ? "fixed inset-0 bg-black/30 z-50" : "hidden")} />
      <PopoverContent
        className={cn(
          "p-0",
          "min-w-[300px]",
          "shadow-xl",
          "border-border",
          "rounded-md",
          "overflow-hidden",
          popoverClassName
        )}
        align="center"
        side="top"
        sideOffset={8}
        style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          marginBottom: '8px',
          width: '400px',
          maxHeight: '600px',
        }}
      >
        <Command shouldFilter={false} className="h-full overflow-hidden">
          <CommandInput
            ref={inputRef}
            placeholder={searchPlaceholder}
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={(e) => {
              // Handle Enter key
              if (e.key === "Enter") {
                if (inputValue && !open) {
                  setOpen(true);
                } else if (open && inputValue) {
                  e.preventDefault();
                  const exactMatch = filteredOptions.find(
                    (opt) =>
                      opt.label.toLowerCase() === inputValue.toLowerCase()
                  );
                  if (exactMatch) {
                    handleSelectOption(exactMatch.value);
                  } else {
                    handleSelectOption(inputValue);
                  }
                }
              }

              // Don't block other navigation keys
              if (["ArrowUp", "ArrowDown", "Escape", "Tab", "Home", "End", "PageUp", "PageDown"].includes(e.key)) {
                return;
              }
            }}
            className="h-10"
          />
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(600px - 40px)' }}>
            <CommandList
              className="beautiful-scrollbar focus-visible:outline-none focus-visible:ring-0"
              onKeyDown={(e) => {
                // Handle numpad navigation
                if (e.key === "8" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const list = e.currentTarget;
                  const selectedItem = list.querySelector('[aria-selected="true"]') as HTMLElement;
                  const prevItem = selectedItem?.previousElementSibling as HTMLElement;
                  if (prevItem) prevItem.click();
                }
                if (e.key === "2" || e.key === "ArrowDown") {
                  e.preventDefault();
                  const list = e.currentTarget;
                  const selectedItem = list.querySelector('[aria-selected="true"]') as HTMLElement;
                  const nextItem = selectedItem?.nextElementSibling as HTMLElement ||
                    list.querySelector('[cmdk-item]') as HTMLElement;
                  if (nextItem) nextItem.click();
                }
                if (e.key === "Home") {
                  e.preventDefault();
                  const list = e.currentTarget;
                  const firstItem = list.querySelector('[cmdk-item]') as HTMLElement;
                  if (firstItem) firstItem.click();
                }
                if (e.key === "End") {
                  e.preventDefault();
                  const list = e.currentTarget;
                  const items = list.querySelectorAll('[cmdk-item]');
                  const lastItem = items[items.length - 1] as HTMLElement;
                  if (lastItem) lastItem.click();
                }
              }}
              onWheel={(e) => {
                // React to wheel events naturally as we're using native overflow
                e.stopPropagation();
              }}
            >
              <CommandEmpty>
                {inputValue ? null : emptyResultText}
              </CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => {
                      handleSelectOption(option.value);
                    }}
                    className="cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedOption?.value === option.value
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {renderOption ? renderOption(option) : option.label}
                  </CommandItem>
                ))}
                {inputValue && (
                  <CommandItem
                    key="__create__"
                    value={inputValue}
                    onSelect={() => {
                      handleSelectOption(inputValue);
                    }}
                    className="text-muted-foreground italic cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {createText(inputValue)}
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/*
.beautiful-scrollbar::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.beautiful-scrollbar::-webkit-scrollbar-thumb {
  background-color: hsl(var(--muted)); 
  border-radius: 10px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.beautiful-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: hsl(var(--muted-foreground)); 
}
.beautiful-scrollbar::-webkit-scrollbar-track {
  background: transparent; 
  border-radius: 10px;
}
.beautiful-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--muted)) transparent; 
}
*/
