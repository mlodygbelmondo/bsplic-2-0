import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const TOASTER_OFFSET = {
  top: "calc(4.75rem + env(safe-area-inset-top, 0px))",
  right: 16,
  bottom: 16,
  left: 16,
} satisfies NonNullable<ToasterProps["offset"]>;

const DEFAULT_TOAST_OPTIONS = {
  duration: 2200,
  classNames: {
    toast:
      "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
    description: "group-[.toast]:text-muted-foreground",
    actionButton:
      "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
    cancelButton:
      "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
  },
} satisfies NonNullable<ToasterProps["toastOptions"]>;

const Toaster = ({
  position = "top-center",
  mobileOffset = 16,
  offset = TOASTER_OFFSET,
  toastOptions,
  className,
  ...props
}: ToasterProps) => {
  const mergedToastOptions = {
    ...DEFAULT_TOAST_OPTIONS,
    ...toastOptions,
    classNames: {
      ...DEFAULT_TOAST_OPTIONS.classNames,
      ...toastOptions?.classNames,
    },
  };

  return (
    <Sonner
      theme="system"
      position={position}
      mobileOffset={mobileOffset}
      offset={offset}
      className={["toaster group", className].filter(Boolean).join(" ")}
      toastOptions={mergedToastOptions}
      {...props}
    />
  );
};

export { Toaster, toast };
