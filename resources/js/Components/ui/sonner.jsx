import { Toaster as Sonner } from "sonner";
import useTheme from "@/Hooks/useTheme";

const Toaster = ({ ...props }) => {
  const { currentTheme = "system" } = useTheme();

  return (
    <Sonner
      theme={currentTheme}
      className="toaster group data-rich-colors=true"
      position="bottom-right"
      richColors
      visibleToasts={5}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:[&:not([data-type])]:bg-background group-[.toaster]:[&:not([data-type])]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton: "[&>svg]:size-4 size-7",
          icon: "mr-4",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
