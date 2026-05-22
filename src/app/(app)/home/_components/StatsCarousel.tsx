"use client";

import * as React from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
  dotsClassName?: string;
};

export function StatsCarousel({ children, className, dotsClassName }: Props) {
  const items = React.Children.toArray(children);
  const cardsPerSlide = 2;
  const slideCount = Math.max(1, Math.ceil(items.length / cardsPerSlide));

  const [slide, setSlide] = React.useState(0);

  const clampedSlide = Math.min(slide, slideCount - 1);
  const isFirst = clampedSlide <= 0;
  const isLast = clampedSlide >= slideCount - 1;

  const goPrev = React.useCallback(() => setSlide((s) => Math.max(0, s - 1)), []);
  const goNext = React.useCallback(() => setSlide((s) => Math.min(slideCount - 1, s + 1)), [slideCount]);

  const slides = React.useMemo(() => {
    const out: Array<React.ReactNode[]> = [];
    for (let i = 0; i < items.length; i += cardsPerSlide) {
      out.push(items.slice(i, i + cardsPerSlide));
    }
    return out.length ? out : [[]];
  }, [items]);

  return (
    <div className={className}>
      <div className="relative">
        <div className="overflow-hidden">
          <div
            className="flex"
            style={{
              transform: `translateX(-${clampedSlide * 100}%)`,
              transition: "transform 0.3s ease",
            }}
          >
            {slides.map((pair, idx) => (
              <div key={idx} className="w-full shrink-0 grid grid-cols-2 gap-3">
                {pair[0] ?? <div aria-hidden />}
                {pair[1] ?? <div aria-hidden />}
              </div>
            ))}
          </div>
        </div>

        {slideCount > 1 ? (
          <div className="hidden sm:flex absolute inset-y-0 left-0 right-0 items-center justify-between pointer-events-none px-1">
            <ArrowButton direction="left" disabled={isFirst} onClick={goPrev} />
            <ArrowButton direction="right" disabled={isLast} onClick={goNext} />
          </div>
        ) : null}
      </div>

      {slideCount > 1 ? (
        <div className="sm:hidden mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={isFirst}
            className={[
              "inline-flex items-center justify-center size-9 rounded-full bg-white border border-ink-200 shadow-sm text-ink-700",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            ].join(" ")}
            aria-label="Previous"
          >
            <span aria-hidden className="text-lg leading-none">
              ‹
            </span>
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={isLast}
            className={[
              "inline-flex items-center justify-center size-9 rounded-full bg-white border border-ink-200 shadow-sm text-ink-700",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            ].join(" ")}
            aria-label="Next"
          >
            <span aria-hidden className="text-lg leading-none">
              ›
            </span>
          </button>
        </div>
      ) : null}

      {slideCount > 1 ? (
        <div className={["mt-2 flex justify-center gap-1.5", dotsClassName].filter(Boolean).join(" ")}>
          {Array.from({ length: slideCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSlide(i)}
              className={[
                "text-[11px] leading-none",
                i === clampedSlide ? "text-ink-700" : "text-ink-300 hover:text-ink-400",
              ].join(" ")}
              aria-label={`Go to slide ${i + 1}`}
            >
              <span aria-hidden>{i === clampedSlide ? "●" : "○"}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "left" ? "Previous" : "Next"}
      className={[
        "pointer-events-auto inline-flex items-center justify-center size-9 rounded-full bg-white/90 border border-ink-200 shadow-sm text-ink-700",
        "hover:bg-ink-50",
        disabled ? "opacity-0 pointer-events-none" : "",
      ].join(" ")}
    >
      <span aria-hidden className="text-lg leading-none">
        {direction === "left" ? "‹" : "›"}
      </span>
    </button>
  );
}

