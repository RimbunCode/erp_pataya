import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

import { Button } from "./ui/button";
import React from "react";
import { cn } from "@/lib/utils";

function Combobox({
  options = [],
  search: searchProps,
  onSearchChange,
  option: optionProps,
  onOptionChange,
  templateTrigger,
  templateItem,
  placeholder,
  className,
}) {
  const [open, setOpen] = React.useState(false);
  const [_option, _setOption] = React.useState();
  const [_search, _setSearch] = React.useState();

  const option = optionProps || _option;
  const setOption = onOptionChange || _setOption;
  const search = searchProps || _search;
  const setSearch = onSearchChange || _setSearch;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("flex justify-start w-full ", className)}
        >
          {option ? (
            templateTrigger ? (
              React.Children.only(templateTrigger(option))
            ) : (
              <>option</>
            )
          ) : (
            <>{placeholder}</>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" side="right" align="start">
        <Command>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search..."
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                if (templateItem) {
                  const child = React.Children.only(templateItem(opt));

                  return React.cloneElement(child, {
                    onSelect: (value) => {
                      child.props.onSelect?.(value);
                      setOpen(false);
                    },
                  });
                }
                return (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={(value) => {
                      setOption(value);
                      setOpen(false);
                    }}
                  >
                    {opt}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default Combobox;
