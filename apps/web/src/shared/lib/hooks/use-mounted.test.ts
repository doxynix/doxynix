// @vitest-environment jsdom
import { createElement, type ReactElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMounted } from "./use-mounted";

function Probe({ onRender }: Readonly<{ onRender?: (mounted: boolean) => void }>) {
  const mounted = useMounted();
  onRender?.(mounted);
  return createElement("span", null, String(mounted));
}

async function hydrate(element: ReactElement, html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);

  let root: ReturnType<typeof hydrateRoot> | null = null;
  await act(async () => {
    root = hydrateRoot(container, element);
  });

  return {
    container,
    unmount: async () => {
      await act(async () => {
        root?.unmount();
      });
    },
  };
}

describe("useMounted", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("is false during the server pass", () => {
    const seen: boolean[] = [];
    const html = renderToString(createElement(Probe, { onRender: (value) => seen.push(value) }));

    expect(seen).toEqual([false]);
    expect(html).toContain("false");
  });

  it("is true during the client pass and stays true across rerenders", () => {
    const { rerender, result } = renderHook(() => useMounted());

    expect(result.current).toBe(true);

    rerender();
    rerender();

    expect(result.current).toBe(true);
  });

  it("hydrates server HTML without a mismatch", async () => {
    const probe = await hydrate(createElement(Probe), renderToString(createElement(Probe)));

    expect(probe.container.textContent).toBe("true");

    await probe.unmount();
  });

  // `getServerSnapshot` is what makes the hydration pass agree with the SSR HTML, so the very first
  // client render still reports `false` and only the follow-up render flips to `true`. A
  // `useState(true)` implementation would report `true` immediately and mismatch the server HTML.
  it("reports the server snapshot on the hydration pass, then flips to the client one", async () => {
    const seen: boolean[] = [];

    const probe = await hydrate(
      createElement(Probe, { onRender: (value) => seen.push(value) }),
      renderToString(createElement(Probe)),
    );

    expect(seen).toEqual([false, true]);

    await probe.unmount();
  });
});
