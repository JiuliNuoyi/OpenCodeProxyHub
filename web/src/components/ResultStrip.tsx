interface ResultStripProps {
  results: Array<{ ok: boolean }>;
  /** Number of cells to render; newest results align to the right. */
  slots?: number;
}

// Renders the last `slots` request outcomes as a segmented bar:
// green = success, red = failure, grey = no data yet (left-padded).
export function ResultStrip({ results, slots = 20 }: ResultStripProps) {
  const recent = results.slice(-slots);
  const pad = Math.max(0, slots - recent.length);
  const cells = [
    ...Array.from({ length: pad }, () => null),
    ...recent,
  ];
  return (
    <div className="flex gap-px" title={`近 ${recent.length} 次请求结果（最新在右）`}>
      {cells.map((cell, i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded-sm ${cell === null ? "bg-base-300" : cell.ok ? "bg-success" : "bg-error"}`}
        />
      ))}
    </div>
  );
}
