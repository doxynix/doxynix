// @vitest-environment jsdom
import { createElement } from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Sidebar, SidebarProvider, SidebarRail } from "./sidebar";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// jsdom implements neither matchMedia nor Pointer Events capture. Assigned
// unconditionally: the DOM types claim they exist, so `??=` reads as dead code.
beforeEach(() => {
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = () => false;

  window.matchMedia = (query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  });

  localStorage.clear();
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
});

function mount({ defaultOpen = true } = {}) {
  return render(
    createElement(
      SidebarProvider,
      { defaultOpen },
      createElement(
        Sidebar,
        { collapsible: "offcanvas", variant: "sidebar" },
        createElement("p", { "data-testid": "content" }, "content"),
        createElement(SidebarRail),
      ),
    ),
  );
}

const rail = () => screen.getByRole("button", { name: "resize_sidebar" });
const wrapper = () => document.querySelector("[data-slot='sidebar-wrapper']");
const aside = () => document.querySelector("[data-slot='sidebar-container']");
// offcanvas keeps the panel mounted and slides it out of view, so collapse is
// observable through data-state rather than through absence.
const state = () => document.querySelector("[data-slot='sidebar']")?.getAttribute("data-state");
const width = () => (wrapper() as HTMLElement).style.getPropertyValue("--sidebar-width");

/** Waits a frame so the hook's rAF-batched width update lands. */
async function nextFrame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

async function drag(from: number, to: number) {
  act(() => {
    rail().dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: from }),
    );
  });
  act(() => {
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: to }));
  });
  // Let the rAF-batched width update land.
  await nextFrame();
}

function releaseDrag() {
  act(() => {
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  });
}

describe("SidebarRail", () => {
  it("publishes the resizable width to the sidebar via the CSS variable", () => {
    mount();

    expect(width()).toBe("256px");
    expect(aside()?.className).toContain("w-(--sidebar-width)");
  });

  it("is actually displayed on desktop", () => {
    mount();

    // Regression guard: `hidden` without a `sm:flex` counterpart leaves the rail
    // at display:none, so it exists in the DOM but can never be seen or grabbed.
    expect(rail().className).toContain("hidden");
    expect(rail().className).toContain("sm:flex");
  });

  it("anchors the rail to the panel edge so it clears the app header", () => {
    mount();

    // absolute, not fixed: a fixed rail would span the whole viewport height and
    // sit underneath the header, swallowing clicks on the logo and the trigger.
    expect(rail().className).toContain("absolute");
    expect(rail().className).toContain("-right-2");
    expect(rail().className).not.toContain("fixed");
    // The hairline is the rail's midpoint, so a translate would sit it inboard.
    expect(rail().className).not.toContain("translate");
  });

  it("falls back to a viewport-anchored rail when collapsed", () => {
    mount({ defaultOpen: false });

    expect(rail().className).toContain("fixed");
    expect(rail().className).toContain("-left-2");
  });

  it("resizes on drag and commits the width", async () => {
    mount();

    await drag(256, 380);
    expect(width()).toBe("380px");

    releaseDrag();
    expect(localStorage.getItem("app-sidebar-width")).toBe("380");
  });

  it("collapses when dragged down to the minimum", async () => {
    mount();

    await drag(256, 0);
    releaseDrag();

    expect(state()).toBe("collapsed");
    expect(rail().className).toContain("fixed");
    expect(rail().className).toContain("-left-2");
  });

  it("reopens when dragged outwards from the collapsed state", async () => {
    mount({ defaultOpen: false });

    await drag(0, 320);
    releaseDrag();

    expect(width()).toBe("320px");
  });

  it("stays collapsed when a reopen drag is too short", async () => {
    mount({ defaultOpen: false });

    await drag(0, 4);
    releaseDrag();

    expect(width()).toBe("256px");
  });

  it("toggles on a click that never travels", () => {
    mount();

    act(() => {
      rail().dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 256 }),
      );
    });
    act(() => {
      rail().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(state()).toBe("collapsed");
  });

  it("does not toggle after a real drag", async () => {
    mount();

    await drag(256, 380);
    releaseDrag();
    act(() => {
      rail().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // The drag resized; the trailing click must not also collapse the sidebar.
    expect(state()).toBe("expanded");
    expect(width()).toBe("380px");
  });
});
