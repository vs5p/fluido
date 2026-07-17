export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      role="tablist"
      className="inline-flex items-center gap-0.5 p-0.5 rounded-lg"
      style={{ background: "var(--bg-control)", border: "1px solid var(--separator)" }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className="px-3 py-1 text-[13px] font-medium rounded-md transition-all"
            style={{
              background: active ? "var(--bg-hover)" : "transparent",
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              boxShadow: active
                ? "inset 0 0 0 0.5px rgba(255,255,255,0.10), 0 1px 2px rgba(0,0,0,0.25)"
                : "none",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
