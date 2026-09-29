export function Icon({ name }: { name: "up" | "down" | "check" | "close" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d={
          name === "up"
            ? "m6 15 6-6 6 6"
            : name === "down"
              ? "m6 9 6 6 6-6"
              : name === "check"
                ? "m5 12 4 4L19 6"
                : "m6 6 12 12M18 6 6 18"
        }
      />
    </svg>
  );
}
