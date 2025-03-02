import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { DialogHeader, DialogTitle } from "./ui/dialog";
import { Drawer, DrawerContent, DrawerTrigger } from "./ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import React, { useEffect, useRef } from "react";

import { Button } from "./ui/button";
import { ChevronDown } from "lucide-react";
import { DialogDescription } from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/Hooks/use-mobile";

function Combobox({
  options = [],
  search: searchProps,
  onSearchChange,
  value: optionProps,
  onValueChange,
  templateTrigger,
  templateItem,
  placeholder,
  className,
}) {
  const commandRef = useRef();
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const [_option, _setOption] = React.useState();
  const [_search, _setSearch] = React.useState();

  const option = optionProps || _option;
  const setOption = onValueChange || _setOption;
  const search = searchProps || _search;
  const setSearch = onSearchChange || _setSearch;

  useEffect(() => {
    if (open) {
      commandRef.current?.focus();
    }
  }, [open]);

  const Parent = isMobile ? Drawer : Popover;
  const ParentTrigger = isMobile ? DrawerTrigger : PopoverTrigger;
  const ParentContent = isMobile ? DrawerContent : PopoverContent;

  return (
    <Parent open={open} onOpenChange={setOpen} modal={false}>
      <ParentTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "flex justify-between w-full bg-accent h-8 ",
            className,
          )}
        >
          {option ? (
            templateTrigger ? (
              templateTrigger(option)
            ) : (
              <>option</>
            )
          ) : (
            <>{placeholder}</>
          )}
          <ChevronDown className="w-4 h-4 ml-2" />
        </Button>
      </ParentTrigger>
      <ParentContent className="p-0" side="bottom" align="start">
        {isMobile && (
          <DialogHeader className="sr-only">
            <DialogTitle>Choose an option</DialogTitle>
            <DialogDescription></DialogDescription>
          </DialogHeader>
        )}
        <Command>
          <CommandInput
            ref={commandRef}
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
                      setSearch("");
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
      </ParentContent>
    </Parent>
  );
}

export default Combobox;
