export function TrafficLights({ inactive = false }: { inactive?: boolean }) {
  const color = inactive ? "#555" : undefined;
  return (
    <div className="flex items-center gap-2 px-3 py-3">
      <span
        className="mac-traffic-light"
        style={{ background: color ?? "#ff5f57" }}
        aria-hidden
      />
      <span
        className="mac-traffic-light"
        style={{ background: color ?? "#febc2e" }}
        aria-hidden
      />
      <span
        className="mac-traffic-light"
        style={{ background: color ?? "#28c840" }}
        aria-hidden
      />
    </div>
  );
}
