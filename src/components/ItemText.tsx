"use client";

import { useEffect, useRef } from "react";

function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/** Click-to-edit todo text that grows with its content. Blank is treated as a cancel. */
export default function ItemText({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (text: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    autosize(ref.current);
  }, [value]);

  return (
    <textarea
      ref={ref}
      className="todo-text"
      rows={1}
      defaultValue={value}
      key={value}
      onInput={() => autosize(ref.current)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      onBlur={(e) => {
        const next = e.target.value.trim();
        if (!next) {
          e.target.value = value;
          autosize(ref.current);
          return;
        }
        if (next !== value) onCommit(next);
      }}
    />
  );
}
