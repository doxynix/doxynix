/** Смещения TODO-маркера в документе и класс подсветки CodeMirror. */
export type TodoMarker = {
  className: string;
  end: number;
  start: number;
};

const TAG_REGEX = /\b(todo|fixme|bug|hack|note|xxx)\b/gi;

/**
 * Находит TODO/FIXME/BUG/HACK/NOTE/XXX в текстовом отрезке.
 * Смещения возвращаются абсолютными: offset + индекс совпадения в text.
 */
export const findTodoMarkers = (text: string, offset: number): TodoMarker[] => {
  const markers: TodoMarker[] = [];
  TAG_REGEX.lastIndex = 0;

  for (const match of text.matchAll(TAG_REGEX)) {
    const word = (match[1] ?? match[0]).toUpperCase();
    const urgent = word === "FIXME" || word === "BUG" || word === "XXX";
    const className = urgent
      ? "cm-todo-marker cm-todo-urgent"
      : word === "NOTE"
        ? "cm-note-marker"
        : "cm-todo-marker";
    const start = offset + match.index;
    markers.push({
      className,
      end: start + match[0].length,
      start,
    });
  }

  return markers;
};
