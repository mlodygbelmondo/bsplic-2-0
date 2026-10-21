import { describe, expect, it } from "vitest";

import { getNextScrollChromeState } from "./scroll-chrome";

describe("getNextScrollChromeState", () => {
  it("keeps chrome visible through small downward scroll jitter", () => {
    const first = getNextScrollChromeState(undefined, {
      scrollTop: 18,
      scrollHeight: 1800,
      clientHeight: 700,
    });
    const second = getNextScrollChromeState(first, {
      scrollTop: 34,
      scrollHeight: 1800,
      clientHeight: 700,
    });

    expect(second.hidden).toBe(false);
  });

  it("hides chrome only after deliberate downward travel", () => {
    const first = getNextScrollChromeState(undefined, {
      scrollTop: 42,
      scrollHeight: 1800,
      clientHeight: 700,
    });
    const second = getNextScrollChromeState(first, {
      scrollTop: 78,
      scrollHeight: 1800,
      clientHeight: 700,
    });

    expect(second.hidden).toBe(true);
  });

  it("does not reveal chrome from bottom-edge layout correction", () => {
    const next = getNextScrollChromeState(
      { hidden: true, lastScrollTop: 1216, travel: 0 },
      {
        scrollTop: 1198,
        scrollHeight: 1900,
        clientHeight: 700,
      },
    );

    expect(next.hidden).toBe(true);
  });

  it("reveals chrome after deliberate upward travel away from the bottom", () => {
    const first = getNextScrollChromeState(
      { hidden: true, lastScrollTop: 1000, travel: 0 },
      {
        scrollTop: 978,
        scrollHeight: 2400,
        clientHeight: 700,
      },
    );
    const second = getNextScrollChromeState(first, {
      scrollTop: 950,
      scrollHeight: 2400,
      clientHeight: 700,
    });

    expect(second.hidden).toBe(false);
  });
});
