import { EyeIcon, EyeOffIcon } from "lucide-react";
import React, { forwardRef, useEffect, useState } from "react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";

export default forwardRef(function PasswordInput(
  { className, disabled, visible, onVisibleChange, ...props },
  ref,
) {
  const [internalVisible, setInternalVisible] = useState(false);
  const isControlled = visible !== undefined;
  const isVisible = isControlled ? Boolean(visible) : internalVisible;

  useEffect(() => {
    if (isControlled) {
      setInternalVisible(Boolean(visible));
    }
  }, [isControlled, visible]);

  const setVisibility = (nextVisible) => {
    if (!isControlled) {
      setInternalVisible(nextVisible);
    }

    onVisibleChange?.(nextVisible);
  };

  const toggleVisibility = () => setVisibility(!isVisible);
  return (
    <div
      className={cn(
        "flex h-full bg-muted items-center  overflow-hidden border rounded-md cursor-default group/model relative focus-within:border-0 border-input ring-offset-background  focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <Input
        ref={ref}
        disabled={disabled}
        type={isVisible ? "text" : "password"}
        name="password"
        autoComplete="password"
        className={cn(
          "focus:border-0! bg-inherit! disabled:opacity-100! h-8 w-full rounded-none! pr-2! border-0!  focus-visible:ring-0! focus-visible:ring-offset-0!  ",
        )}
        {...props}
      />
      <div className="flex items-center h-8 pr-2 w-fit gap-x-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-6")}
          onClick={toggleVisibility}
        >
          {isVisible ? (
            <EyeOffIcon className="size-3.5" aria-hidden="true" />
          ) : (
            <EyeIcon className="size-3.5" aria-hidden="true" />
          )}
        </Button>
      </div>
    </div>
  );
});
