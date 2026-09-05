import { Avatar, type AvatarProps } from "@mui/material";

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic coloured initials avatar — no image assets needed. */
export function Monogram({
  name,
  hue,
  ...props
}: { name: string; hue?: number } & AvatarProps) {
  const h = hue ?? hash(name) % 360;
  return (
    <Avatar
      {...props}
      sx={{
        bgcolor: `hsl(${h} 55% 45%)`,
        color: "#fff",
        fontWeight: 700,
        fontSize: props.sx && (props.sx as any).width ? undefined : 14,
        ...props.sx,
      }}
    >
      {initials(name)}
    </Avatar>
  );
}
