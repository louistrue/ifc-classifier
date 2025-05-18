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
}: CreatableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
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
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "p-0",
          "min-w-[--radix-popover-trigger-width]",
          "w-[300px]",
          "sm:w-[350px]",
          "max-w-[calc(100vw-2rem)]",
          "sm:max-w-sm",
          "md:max-w-md",
          popoverClassName
        )}
        align="center"
        side="right"
        sideOffset={8}
        sticky="partial"
        collisionPadding={10}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={(e) => {
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
            }}
            className="h-10"
          />
          <CommandList className="max-h-[80vh] beautiful-scrollbar">
            <CommandEmpty>{!showCreateOption && emptyResultText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    handleSelectOption(option.value);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedOption?.value === option.value
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
              {showCreateOption && (
                <CommandItem
                  key="__create__"
                  value={inputValue}
                  onSelect={() => {
                    handleSelectOption(inputValue);
                  }}
                  className="text-muted-foreground italic cursor-pointer"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {createText(inputValue)}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
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
