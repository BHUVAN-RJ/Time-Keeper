"use client";

import * as Dialog from "@radix-ui/react-dialog";

export function RitualModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  dismissible = true,
  position = "center",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dismissible?: boolean;
  position?: "center" | "bottom";
}) {
  return (
    <Dialog.Root open={open} onOpenChange={dismissible ? onOpenChange : undefined}>
      <Dialog.Portal>
        <Dialog.Overlay className="ritual-overlay" />
        <Dialog.Content
          className={`ritual-content ${position === "bottom" ? "ritual-content-bottom" : ""}`}
          onEscapeKeyDown={(e) => {
            if (!dismissible) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (!dismissible) e.preventDefault();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-tk-line px-6 py-5">
              <Dialog.Title className="text-lg font-semibold text-tk-ink">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-[12px] text-tk-ink-4">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">
                  {title}
                </Dialog.Description>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {children}
            </div>
            {footer ? (
              <div className="shrink-0 border-t border-tk-line px-6 py-4">
                {footer}
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
