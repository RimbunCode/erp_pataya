export default function Icon({ d, cls = "w-4 h-4" }) {
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d={d}
      />
    </svg>
  );
}
