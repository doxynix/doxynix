export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function calculateScrollStep(
  startTime: number,
  currentTime: number,
  duration: number,
  startPosition: number,
  distance: number,
): { position: number; isFinished: boolean } {
  const timeElapsed = currentTime - startTime;
  const progress = Math.min(timeElapsed / duration, 1);
  const easeProgress = easeInOutCubic(progress);

  return {
    isFinished: timeElapsed >= duration,
    position: startPosition + distance * easeProgress,
  };
}

export function smoothScrollTo(targetId: string, offset: number = 80, duration: number = 800) {
  if (typeof window === "undefined") {
    return;
  }

  const targetElement = document.getElementById(targetId);

  if (!targetElement) {
    console.warn(`Element with id #${targetId} not found`);
    return;
  }

  const startPosition = window.scrollY;
  const targetPosition = targetElement.getBoundingClientRect().top + startPosition - offset;
  const targetY = Math.max(0, targetPosition);

  const prefersReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (duration <= 0 || prefersReducedMotion) {
    window.scrollTo(0, targetY);
    window.history.replaceState(null, "", `#${targetId}`);
    return;
  }

  const distance = targetY - startPosition;
  let startTime: null | number = null;

  const animation = (currentTime: number) => {
    startTime ??= currentTime;

    const { position, isFinished } = calculateScrollStep(
      startTime,
      currentTime,
      duration,
      startPosition,
      distance,
    );

    window.scrollTo(0, position);

    if (!isFinished) {
      requestAnimationFrame(animation);
    } else {
      window.history.replaceState(null, "", `#${targetId}`);
    }
  };

  requestAnimationFrame(animation);
}
