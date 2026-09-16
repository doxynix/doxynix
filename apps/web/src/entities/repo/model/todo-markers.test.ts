import { describe, expect, it } from "vitest";

import { findTodoMarkers } from "./todo-markers";

describe("findTodoMarkers", () => {
  it("returns no markers for empty text", () => {
    expect(findTodoMarkers("", 0)).toEqual([]);
  });

  it("returns no markers for text without tags", () => {
    expect(findTodoMarkers("// just a comment", 0)).toEqual([]);
  });

  it("respects word boundaries (today, todos)", () => {
    expect(findTodoMarkers("// today is fine, todos pending", 0)).toEqual([]);
  });

  it("matches tags case-insensitively", () => {
    expect(findTodoMarkers("todo Todo TODO", 0)).toHaveLength(3);
  });

  it("classifies FIXME, BUG and XXX as urgent", () => {
    const markers = findTodoMarkers("// FIXME bug XXX", 0);
    expect(markers.every((m) => m.className === "cm-todo-marker cm-todo-urgent")).toBe(true);
    expect(markers).toHaveLength(3);
  });

  it("classifies NOTE as a note marker", () => {
    expect(findTodoMarkers("// note", 0)).toEqual([
      { className: "cm-note-marker", end: 7, start: 3 },
    ]);
  });

  it("classifies TODO and HACK as regular markers", () => {
    const markers = findTodoMarkers("// TODO: hack", 0);
    expect(markers).toEqual([
      { className: "cm-todo-marker", end: 7, start: 3 },
      { className: "cm-todo-marker", end: 13, start: 9 },
    ]);
  });

  it("returns absolute offsets from the given base", () => {
    const markers = findTodoMarkers("// TODO: fix", 100);
    expect(markers).toEqual([{ className: "cm-todo-marker", end: 107, start: 103 }]);
  });

  it("handles tags at the start and end of a segment", () => {
    expect(findTodoMarkers("TODO", 0)).toEqual([{ className: "cm-todo-marker", end: 4, start: 0 }]);
    expect(findTodoMarkers("a TODO", 0)).toEqual([
      { className: "cm-todo-marker", end: 6, start: 2 },
    ]);
  });

  it("finds repeated tags in one segment", () => {
    expect(findTodoMarkers("TODO TODO", 0)).toHaveLength(2);
  });

  it("mixes classes in a single segment", () => {
    expect(findTodoMarkers("FIXME and TODO and NOTE", 0)).toEqual([
      { className: "cm-todo-marker cm-todo-urgent", end: 5, start: 0 },
      { className: "cm-todo-marker", end: 14, start: 10 },
      { className: "cm-note-marker", end: 23, start: 19 },
    ]);
  });

  it("is stable across repeated calls (regex lastIndex state)", () => {
    const first = findTodoMarkers("// TODO a", 0);
    findTodoMarkers("// no tags here", 0);
    const second = findTodoMarkers("// TODO a", 0);
    expect(second).toEqual(first);
  });
});
