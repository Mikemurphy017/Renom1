export function Logo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2.5">
        <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
          <rect x="1" y="1" width="30" height="30" rx="7" fill="none" stroke="#B08D57" strokeWidth="1.2" />
          <path d="M10 23V9h6.2c3 0 4.9 1.7 4.9 4.3 0 2-1.1 3.4-2.9 4l3.4 5.7h-2.6l-3.1-5.4H12.2V23zm2.2-7.3h3.9c1.7 0 2.7-.9 2.7-2.4s-1-2.3-2.7-2.3h-3.9z" fill="#D2B07A" />
        </svg>
        <span className="font-serif text-[21px] tracking-tight text-[#F2EEE6]">Renom</span>
      </div>
    </div>
  );
}
