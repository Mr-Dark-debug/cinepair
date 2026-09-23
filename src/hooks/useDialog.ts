import { useEffect, useRef } from "react";

const stack: symbol[] = [];

export function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const id = Symbol("dialog");
    stack.push(id);
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea, a[href], [tabindex="0"]') || []).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const handle = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key === "Tab") {
        const elements = focusable();
        const index = elements.indexOf(document.activeElement as HTMLElement);
        if (event.shiftKey && index <= 0) { event.preventDefault(); elements[elements.length - 1]?.focus(); }
        if (!event.shiftKey && (index === -1 || index === elements.length - 1)) { event.preventDefault(); elements[0]?.focus(); }
      }
    };
    window.addEventListener("keydown", handle, true);
    return () => {
      const index = stack.indexOf(id);
      if (index >= 0) stack.splice(index, 1);
      window.removeEventListener("keydown", handle, true);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
  return ref;
}
