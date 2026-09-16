// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMapCommands } from "./use-map-commands";

const mockFitView = vi.fn();
const mockZoomIn = vi.fn();
const mockZoomOut = vi.fn();
const mockGetNodes = vi.fn();
let mockSearchParamNode: string | null = null;

vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({
    fitView: mockFitView,
    getNodes: mockGetNodes,
    zoomIn: mockZoomIn,
    zoomOut: mockZoomOut,
  }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "node" ? mockSearchParamNode : null),
  }),
}));

describe("useMapCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamNode = null;
    mockGetNodes.mockReturnValue([]);
  });

  it("fitView вызывает fitView с нужными параметрами", () => {
    const { result } = renderHook(() => useMapCommands());
    result.current.fitView();
    expect(mockFitView).toHaveBeenCalledWith({ duration: 400, padding: 0.1 });
  });

  it("zoomIn и zoomOut вызывают соответствующие методы", () => {
    const { result } = renderHook(() => useMapCommands());
    result.current.zoomIn();
    expect(mockZoomIn).toHaveBeenCalledWith({ duration: 400 });

    result.current.zoomOut();
    expect(mockZoomOut).toHaveBeenCalledWith({ duration: 400 });
  });

  it("focusSelected фокусируется на выбранной ноде (selected === true)", () => {
    mockGetNodes.mockReturnValue([
      { id: "node-1", selected: false },
      { id: "node-2", selected: true },
    ]);

    const { result } = renderHook(() => useMapCommands());
    result.current.focusSelected();

    expect(mockFitView).toHaveBeenCalledWith({
      duration: 400,
      nodes: [{ id: "node-2" }],
      padding: 1,
    });
  });

  it("focusSelected берёт id ноды из searchParams, если нет выбранной ноды", () => {
    mockSearchParamNode = "node-from-url";
    mockGetNodes.mockReturnValue([
      { id: "node-1", selected: false },
      { id: "node-from-url", selected: false },
    ]);

    const { result } = renderHook(() => useMapCommands());
    result.current.focusSelected();

    expect(mockFitView).toHaveBeenCalledWith({
      duration: 400,
      nodes: [{ id: "node-from-url" }],
      padding: 1,
    });
  });

  it("focusSelected откатывается на общий fitView, если подходящей ноды нет", () => {
    mockGetNodes.mockReturnValue([{ id: "node-1", selected: false }]);

    const { result } = renderHook(() => useMapCommands());
    result.current.focusSelected();

    expect(mockFitView).toHaveBeenCalledWith({ duration: 400, padding: 0.1 });
  });
});
