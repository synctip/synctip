import * as React from "react";
import PhoneInputBase, {
  type Country,
  type Value,
  getCountryCallingCode,
} from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";
import { Check, ChevronsUpDown } from "lucide-react";

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

type PhoneInputProps = Omit<
  React.ComponentProps<typeof PhoneInputBase>,
  "onChange" | "value" | "defaultCountry"
> & {
  value?: string;
  onChange?: (value: string) => void;
  defaultCountry?: Country;
  className?: string;
};

/**
 * Shadcn-styled phone input. Country dropdown is a searchable Popover +
 * Command list with flags rendered per row; the phone field outputs E.164
 * (e.g. "+972501234567") via `onChange`.
 */
export function PhoneInput({
  className,
  value,
  onChange,
  defaultCountry = "IL",
  ...rest
}: PhoneInputProps) {
  return (
    <PhoneInputBase
      {...rest}
      international
      defaultCountry={defaultCountry}
      value={value as Value | undefined}
      onChange={(v) => onChange?.((v ?? "") as string)}
      countryCallingCodeEditable={false}
      countrySelectComponent={CountrySelect}
      className={cn(
        // Outer shell: hairline gap between country trigger and input.
        "flex h-9 w-full min-w-0 items-center rounded-md border border-input bg-transparent text-base shadow-xs transition-[color,box-shadow] outline-none focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30",
        // Strip the library's own borders on the inner <input>.
        "[&_.PhoneInputInput]:h-full [&_.PhoneInputInput]:w-full [&_.PhoneInputInput]:min-w-0 [&_.PhoneInputInput]:border-0 [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:px-3 [&_.PhoneInputInput]:outline-none [&_.PhoneInputInput]:placeholder:text-muted-foreground",
        className,
      )}
    />
  );
}

type CountryOption = {
  value: Country | undefined;
  label: string;
};

type CountrySelectProps = {
  value?: Country;
  onChange: (country: Country) => void;
  options: CountryOption[];
  disabled?: boolean;
  readOnly?: boolean;
};

function CountrySelect({
  value,
  onChange,
  options,
  disabled,
  readOnly,
}: CountrySelectProps) {
  const [open, setOpen] = React.useState(false);
  const countries = options.filter(
    (o): o is { value: Country; label: string } => Boolean(o.value),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || readOnly}
          className="flex h-full gap-1 rounded-r-none border-r border-input px-2 hover:bg-transparent focus-visible:ring-0"
        >
          <FlagIcon country={value} />
          <ChevronsUpDown className="size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-70 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search country..." />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {countries.map(({ value: country, label }) => (
                <CommandItem
                  key={country}
                  value={`${label} ${country} +${getCountryCallingCode(country)}`}
                  onSelect={() => {
                    onChange(country);
                    setOpen(false);
                  }}
                  className="gap-2"
                >
                  <FlagIcon country={country} />
                  <span className="flex-1 truncate">{label}</span>
                  <span className="text-muted-foreground text-xs">
                    +{getCountryCallingCode(country)}
                  </span>
                  <Check
                    className={cn(
                      "size-4",
                      country === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function FlagIcon({ country }: { country?: Country }) {
  const Flag = country ? flags[country] : undefined;
  return (
    <span className="inline-flex h-4 w-6 shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-muted/40 [&>svg]:h-full [&>svg]:w-full [&>svg]:object-cover">
      {Flag ? <Flag title={country ?? ""} /> : null}
    </span>
  );
}
