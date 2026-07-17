import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

type Toast = { id: number; text: string };
let counter = 0;
const listeners = new Set<(t: Toast) => void>();

export function toast(text: string) {
  const t: Toast = { id: ++counter, text };
  listeners.forEach((cb) => cb(t));
}

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const cb = (t: Toast) => {
      setItems((s) => [...s, t]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), 3000);
    };
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none"
      style={{ top: "calc(12px + env(safe-area-inset-top, 0px))" }}
      aria-live="polite"
    >
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="mac-panel px-4 py-2 text-[13px] font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
