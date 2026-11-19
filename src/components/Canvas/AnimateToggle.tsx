import { setAnimating, useAnimationClock } from "./animationClock";

/* Liga/desliga a animação (a mesma em todo o app). */
export function AnimateToggle({ title }: { title?: string }) {
  const { running } = useAnimationClock();

  return (
    <label title={title} className="animate-toggle">
      <input
        type="checkbox"
        checked={running}
        onChange={(event) => setAnimating(event.target.checked)}
      />{" "}
      Animar
    </label>
  );
}
