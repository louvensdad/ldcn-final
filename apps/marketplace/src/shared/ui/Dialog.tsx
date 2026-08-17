import { useEffect, useRef, type ReactNode } from "react";
import { T } from "../../design/tokens";

const FOCUSABLE_SELECTOR = 'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  titleId: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Backdrop + Escape-to-close + manual Tab focus trap, shared by every modal form in the app. */
export function Dialog({ titleId, title, onClose, children }: DialogProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key !== "Tab" || !formRef.current) return;
    const focusable = formRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <form
        ref={formRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        onSubmit={(e) => e.preventDefault()}
        style={{
          width: "min(440px, 92vw)",
          background: T.surfaceEl,
          border: `1px solid ${T.borderMid}`,
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <h2 id={titleId} style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: T.text }}>
          {title}
        </h2>
        {children}
      </form>
    </div>
  );
}
