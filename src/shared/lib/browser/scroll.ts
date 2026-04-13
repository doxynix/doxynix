function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function smoothScrollTo(targetId: string, offset: number = 80, duration: number = 800) {
  const targetElement = document.getElementById(targetId);
  if (!targetElement) {
    console.warn(`Element with id #${targetId} not found`);
    return;
  }

  const startPosition = window.pageYOffset;
  const targetPosition = targetElement.getBoundingClientRect().top + startPosition - offset;

  if (duration <= 0) {
    window.scrollTo(0, Math.max(0, targetPosition));
    return;
  }

  const distance = targetPosition - startPosition;
  let startTime: null | number = null;

  const animation = (currentTime: number) => {
    startTime ??= currentTime;
    const timeElapsed = currentTime - startTime;
    const progress = Math.min(timeElapsed / duration, 1);
    const easeProgress = easeInOutCubic(progress);

    window.scrollTo(0, startPosition + distance * easeProgress);

    if (timeElapsed < duration) {
      requestAnimationFrame(animation);
    }
  };

  requestAnimationFrame(animation);
}
