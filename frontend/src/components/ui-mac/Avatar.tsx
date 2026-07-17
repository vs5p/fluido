function colorFromUid(uid: string) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 60% 45%)`;
}

export function Avatar({
  uid,
  name,
  src,
  size = 32,
}: {
  uid: string;
  name: string;
  src?: string | null;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-medium"
      style={{
        width: size,
        height: size,
        background: colorFromUid(uid),
        fontSize: size * 0.4,
        letterSpacing: 0,
      }}
      aria-hidden
    >
      {initials || "?"}
    </div>
  );
}
