// @vitest-environment jsdom
import { createElement, type KeyboardEvent, type PointerEvent, useEffect } from "react";
import { act, render, renderHook } from "@testing-library/react";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useResizable } from "./use-resizable";

// Waits a frame so the hook's rAF-batched width update lands.
async function nextFrame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

async function move(clientX: number) {
  act(() => {
    window.dispatchEvent(new PointerEvent("pointermove", { clientX }));
  });
  await nextFrame();
}

function release(eventName: "pointercancel" | "pointerup") {
  act(() => {
    window.dispatchEvent(new PointerEvent(eventName));
  });
}

function down(clientX: number, mocks: { preventDefault?: Mock; setPointerCapture?: Mock } = {}) {
  return {
    button: 0,
    clientX,
    currentTarget: { setPointerCapture: mocks.setPointerCapture ?? vi.fn() },
    pointerId: 1,
    preventDefault: mocks.preventDefault ?? vi.fn(),
  } as unknown as PointerEvent<HTMLElement>;
}

function key(k: string, mocks: { preventDefault?: Mock } = {}) {
  return {
    key: k,
    preventDefault: mocks.preventDefault ?? vi.fn(),
  } as unknown as KeyboardEvent<HTMLElement>;
}

describe("useResizable", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });

  describe("initialization", () => {
    it("falls back to default options", () => {
      const { result } = renderHook(() => useResizable());

      expect(result.current.width).toBe(256);
      expect(result.current.isResizing).toBe(false);
      expect(result.current.handleProps).toMatchObject({
        "aria-orientation": "vertical",
        "aria-valuemax": 480,
        "aria-valuemin": 200,
        "aria-valuenow": 256,
        role: "separator",
        tabIndex: 0,
      });
    });

    it("prefers a persisted width over the default", () => {
      localStorage.setItem("sidebar-width", "350");

      const { result } = renderHook(() =>
        useResizable({ maxWidth: 480, minWidth: 200, storageKey: "sidebar-width" }),
      );

      expect(result.current.width).toBe(350);
    });

    it.for([
      { expected: 200, stored: "100" },
      { expected: 480, stored: "600" },
    ])("clamps the persisted $stored to $expected", ({ expected, stored }) => {
      localStorage.setItem("sidebar-width", stored);

      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 250, storageKey: "sidebar-width" }),
      );

      expect(result.current.width).toBe(expected);
    });

    it("falls back to the default for a non-numeric persisted width", () => {
      localStorage.setItem("sidebar-width", "not-a-number");

      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 250, storageKey: "sidebar-width" }),
      );

      expect(result.current.width).toBe(250);
    });

    it("uses the server-provided width when nothing is stored yet", () => {
      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 250, initialWidth: 380, maxWidth: 480, minWidth: 200 }),
      );

      expect(result.current.width).toBe(380);
    });

    it("clamps a server-provided initial width", () => {
      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 250, initialWidth: 9000, maxWidth: 480, minWidth: 200 }),
      );

      expect(result.current.width).toBe(480);
    });

    it("lets a stored width win over the server-provided one", () => {
      localStorage.setItem("sidebar-width", "300");

      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 250, initialWidth: 380, storageKey: "sidebar-width" }),
      );

      expect(result.current.width).toBe(300);
    });

    it("does not write to storage before anything is resized", () => {
      renderHook(() => useResizable({ defaultWidth: 250, storageKey: "sidebar-width" }));

      expect(localStorage.length).toBe(0);
    });
  });

  describe("pointer drag", () => {
    it("locks the body cursor, disables selection and captures the pointer", () => {
      const { result } = renderHook(() => useResizable());
      const preventDefault = vi.fn();
      const setPointerCapture = vi.fn();

      act(() => {
        result.current.handleProps.onPointerDown(down(250, { preventDefault, setPointerCapture }));
      });

      expect(preventDefault).toHaveBeenCalled();
      expect(setPointerCapture).toHaveBeenCalledWith(1);
      expect(result.current.isResizing).toBe(true);
      expect(document.body.style.cursor).toBe("col-resize");
      expect(document.body.style.userSelect).toBe("none");
    });

    it("ignores non-primary buttons", () => {
      const { result } = renderHook(() => useResizable());
      const event = { ...down(250), button: 2 } as PointerEvent<HTMLElement>;

      act(() => {
        result.current.handleProps.onPointerDown(event);
      });

      expect(result.current.isResizing).toBe(false);
    });

    it("offsets by the grab point, so the panel need not sit flush at the viewport edge", async () => {
      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 300, maxWidth: 500, minWidth: 100 }),
      );

      act(() => {
        result.current.handleProps.onPointerDown(down(500));
      });

      await move(560);

      expect(result.current.width).toBe(360);
    });

    it.for([
      { clientX: 0, expected: 200 },
      { clientX: 900, expected: 400 },
    ])("clamps a drag to clientX $clientX at $expected", async ({ clientX, expected }) => {
      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 300, maxWidth: 400, minWidth: 200 }),
      );

      act(() => {
        result.current.handleProps.onPointerDown(down(300));
      });
      await move(clientX);

      expect(result.current.width).toBe(expected);
    });

    it("grows when a right-anchored panel is dragged left", async () => {
      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 300, maxWidth: 500, minWidth: 100, side: "right" }),
      );

      act(() => {
        result.current.handleProps.onPointerDown(down(900));
      });

      await move(840);

      expect(result.current.width).toBe(360);
    });

    it("commits the final width and restores body styles on pointerup", async () => {
      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 250, maxWidth: 500, minWidth: 100, storageKey: "w" }),
      );

      act(() => {
        result.current.handleProps.onPointerDown(down(250));
      });
      await move(380);
      release("pointerup");

      expect(result.current.isResizing).toBe(false);
      expect(result.current.width).toBe(380);
      expect(document.body.style.cursor).toBe("");
      expect(document.body.style.userSelect).toBe("");
      expect(localStorage.getItem("w")).toBe("380");
    });

    it("applies a queued frame that is still pending when the pointer is released", () => {
      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 300, maxWidth: 500, minWidth: 100 }),
      );

      act(() => {
        result.current.handleProps.onPointerDown(down(250));
      });
      act(() => {
        window.dispatchEvent(new PointerEvent("pointermove", { clientX: 400 }));
      });
      release("pointerup");

      expect(result.current.width).toBe(450);
    });

    it("defers the storage write until the drag ends", async () => {
      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 250, maxWidth: 500, minWidth: 100, storageKey: "w" }),
      );

      act(() => {
        result.current.handleProps.onPointerDown(down(250));
      });
      await move(380);

      expect(localStorage.length).toBe(0);

      release("pointerup");

      expect(localStorage.getItem("w")).toBe("380");
    });

    it("restores the body's prior inline styles rather than blanking them", () => {
      const { result } = renderHook(() => useResizable());
      document.body.style.cursor = "wait";
      document.body.style.userSelect = "text";

      act(() => {
        result.current.handleProps.onPointerDown(down(250));
      });
      expect(document.body.style.cursor).toBe("col-resize");

      release("pointerup");

      expect(document.body.style.cursor).toBe("wait");
      expect(document.body.style.userSelect).toBe("text");
    });

    it("cancels on pointercancel", () => {
      const { result } = renderHook(() => useResizable());

      act(() => {
        result.current.handleProps.onPointerDown(down(250));
      });
      release("pointercancel");

      expect(result.current.isResizing).toBe(false);
      expect(document.body.style.cursor).toBe("");
    });

    it("restores body styles when unmounted mid-drag", () => {
      const { result, unmount } = renderHook(() => useResizable());

      act(() => {
        result.current.handleProps.onPointerDown(down(250));
      });
      expect(document.body.style.cursor).toBe("col-resize");

      unmount();

      expect(document.body.style.cursor).toBe("");
      expect(document.body.style.userSelect).toBe("");
    });
  });

  describe("keyboard", () => {
    it("steps with the arrow key pointing away from the anchored edge", () => {
      const { result } = renderHook(() => useResizable({ defaultWidth: 300, minWidth: 100 }));
      const preventDefault = vi.fn();

      act(() => {
        result.current.handleProps.onKeyDown(key("ArrowRight", { preventDefault }));
      });
      expect(result.current.width).toBe(316);
      expect(preventDefault).toHaveBeenCalled();

      act(() => {
        result.current.handleProps.onKeyDown(key("ArrowLeft"));
      });
      expect(result.current.width).toBe(300);
    });

    it("inverts the arrow keys for a right-anchored panel", () => {
      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 300, minWidth: 100, side: "right" }),
      );

      act(() => {
        result.current.handleProps.onKeyDown(key("ArrowLeft"));
      });

      expect(result.current.width).toBe(316);
    });

    it("jumps to the bounds with Home and End", () => {
      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 300, maxWidth: 400, minWidth: 200 }),
      );

      act(() => {
        result.current.handleProps.onKeyDown(key("End"));
      });
      expect(result.current.width).toBe(400);

      act(() => {
        result.current.handleProps.onKeyDown(key("Home"));
      });
      expect(result.current.width).toBe(200);
    });

    it("ignores unrelated keys", () => {
      const { result } = renderHook(() => useResizable({ defaultWidth: 300 }));
      const preventDefault = vi.fn();

      act(() => {
        result.current.handleProps.onKeyDown(key("a", { preventDefault }));
      });

      expect(result.current.width).toBe(300);
      expect(preventDefault).not.toHaveBeenCalled();
    });

    it("persists keyboard resizes", () => {
      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 300, minWidth: 100, storageKey: "w" }),
      );

      act(() => {
        result.current.handleProps.onKeyDown(key("ArrowRight"));
      });

      expect(localStorage.getItem("w")).toBe("316");
    });
  });

  describe("onDragEnd", () => {
    it("reports the final width and that the pointer moved", async () => {
      const onDragEnd = vi.fn();
      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 300, maxWidth: 500, onDragEnd }),
      );

      act(() => {
        result.current.handleProps.onPointerDown(down(300));
      });
      await move(420);
      release("pointerup");

      expect(onDragEnd).toHaveBeenCalledWith(420, true);
    });

    it("reports no movement for a press that never traveled", () => {
      const onDragEnd = vi.fn();
      const { result } = renderHook(() => useResizable({ defaultWidth: 300, onDragEnd }));

      act(() => {
        result.current.handleProps.onPointerDown(down(300));
      });
      release("pointerup");

      expect(onDragEnd).toHaveBeenCalledWith(300, false);
    });

    it("reports the clamped width when the drag bottoms out", async () => {
      const onDragEnd = vi.fn();
      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 300, maxWidth: 500, minWidth: 200, onDragEnd }),
      );

      act(() => {
        result.current.handleProps.onPointerDown(down(300));
      });
      await move(0);
      release("pointerup");

      expect(onDragEnd).toHaveBeenCalledWith(200, true);
    });

    it("tolerates being omitted", () => {
      const { result } = renderHook(() => useResizable({ defaultWidth: 300 }));

      act(() => {
        result.current.handleProps.onPointerDown(down(300));
      });

      expect(() => release("pointerup")).not.toThrow();
    });
  });

  describe("setWidth", () => {
    it("sets the width directly and persists it", () => {
      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 300, maxWidth: 500, minWidth: 200, storageKey: "w" }),
      );

      act(() => {
        result.current.setWidth(410);
      });

      expect(result.current.width).toBe(410);
      expect(localStorage.getItem("w")).toBe("410");
    });

    it("clamps to the configured bounds", () => {
      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 300, maxWidth: 500, minWidth: 200 }),
      );

      act(() => {
        result.current.setWidth(9999);
      });
      expect(result.current.width).toBe(500);

      act(() => {
        result.current.setWidth(1);
      });
      expect(result.current.width).toBe(200);
    });
  });

  describe("double-click reset", () => {
    it("restores the default width and persists it", () => {
      const { result } = renderHook(() =>
        useResizable({ defaultWidth: 240, maxWidth: 500, minWidth: 100, storageKey: "w" }),
      );

      act(() => {
        result.current.handleProps.onKeyDown(key("End"));
      });
      expect(result.current.width).toBe(500);

      act(() => {
        result.current.handleProps.onDoubleClick();
      });

      expect(result.current.width).toBe(240);
      expect(localStorage.getItem("w")).toBe("240");
    });

    it("ignores the reset while a drag is in flight", async () => {
      const { result } = renderHook(() => useResizable({ defaultWidth: 300, maxWidth: 500 }));

      act(() => {
        result.current.handleProps.onPointerDown(down(300));
      });
      await move(400);

      act(() => {
        result.current.handleProps.onDoubleClick();
      });

      expect(result.current.width).toBe(400);
    });
  });

  it("does not persist when no storageKey is given", () => {
    const { result } = renderHook(() => useResizable({ defaultWidth: 250, maxWidth: 500 }));

    act(() => {
      result.current.handleProps.onKeyDown(key("End"));
    });

    expect(result.current.width).toBe(500);
    expect(localStorage.length).toBe(0);
  });

  describe("with an attached panel", () => {
    let renders = 0;

    function Panel() {
      useEffect(() => {
        renders += 1;
      });
      const { handleProps, panelRef, width } = useResizable({
        cssVar: "--panel-width",
        defaultWidth: 250,
        maxWidth: 500,
        minWidth: 100,
        storageKey: "w",
      });

      return createElement(
        "div",
        { ref: panelRef, style: { "--panel-width": `${width}px` } },
        createElement("div", { ...handleProps, "data-testid": "handle" }),
      );
    }

    beforeEach(() => {
      renders = 0;
      HTMLElement.prototype.setPointerCapture = vi.fn();
    });

    it("drives the CSS variable straight from the pointer, with no per-frame re-render", async () => {
      const { getByTestId } = render(createElement(Panel));
      const rendersBeforeDrag = renders;

      act(() => {
        getByTestId("handle").dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 250 }),
        );
      });

      for (let i = 1; i <= 30; i++) {
        await move(250 + i * 5);
      }

      const panel = getByTestId("handle").parentElement;
      expect(panel?.style.getPropertyValue("--panel-width")).toBe("400px");
      expect(renders - rendersBeforeDrag).toBeLessThanOrEqual(2);

      release("pointerup");
      expect(panel?.style.getPropertyValue("--panel-width")).toBe("400px");
    });

    it("commits to state and storage once, when the drag ends", async () => {
      const { getByTestId } = render(createElement(Panel));

      act(() => {
        getByTestId("handle").dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 250 }),
        );
      });
      await move(320);

      expect(localStorage.length).toBe(0);

      release("pointerup");

      expect(localStorage.getItem("w")).toBe("320");
    });
  });
});
