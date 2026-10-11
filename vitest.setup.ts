import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import type { FormEvent, ReactNode } from "react";
import { afterEach, vi } from "vitest";
// These app modules load before every test file. If a test needs vi.mock for one of them, check that the mock takes effect.
import { CAMPUS_COOKIE } from "./lib/campus";
import { LOW_DATA_ATTR } from "./lib/low-data";
import { dismissToast } from "./lib/toast";
import { createMediaQueryList } from "./tests/helpers/dom";

// --- Next.js modules that need the App Router at runtime -------------------

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/image", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: {
      src: string | { src: string };
      alt: string;
      width?: number;
      height?: number;
      className?: string;
    }) =>
      createElement("img", {
        src: typeof props.src === "string" ? props.src : props.src.src,
        alt: props.alt,
        width: props.width,
        height: props.height,
        className: props.className,
      }),
  };
});

vi.mock("next/form", async () => {
  const { createElement } = await import("react");
  type FormProps = {
    action: string;
    children?: ReactNode;
    className?: string;
    role?: string;
    onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  };
  return {
    // Like next/form after hydration: run onSubmit, then stop the browser's own navigation.
    default: ({ action, children, className, role, onSubmit }: FormProps) =>
      createElement(
        "form",
        {
          action,
          className,
          role,
          onSubmit: (event: FormEvent<HTMLFormElement>) => {
            onSubmit?.(event);
            event.preventDefault();
          },
        },
        children,
      ),
  };
});

// --- jsdom gaps ------------------------------------------------------------

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  writable: true,
  value: (query: string) => createMediaQueryList(query, false),
});

if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

Object.defineProperty(window, "scrollTo", { configurable: true, writable: true, value: vi.fn() });

// jsdom's <dialog> has no behaviour, so give it the parts our overlays use (jsdom already reflects `open`).
// Deliberately simpler than a browser:
// - `close` fires synchronously.
// - Nothing throws InvalidStateError.
// - There's no focus move, inert background, Esc handling, returnValue or :modal.
// The Playwright tests (Task 21) cover real dialog behaviour.
Object.defineProperties(HTMLDialogElement.prototype, {
  show: {
    configurable: true,
    writable: true,
    enumerable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  },
  showModal: {
    configurable: true,
    writable: true,
    enumerable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  },
  close: {
    configurable: true,
    writable: true,
    enumerable: true,
    value(this: HTMLDialogElement) {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  },
});

// --- Reset shared browser state between tests -------------------------------

// Testing Library sets this itself only when Vitest globals are on. With it, React flushes updates inside act().
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  try {
    cleanup();
  } finally {
    // After unmounting, so no component reacts to these resets. Runs even if unmounting threw.
    dismissToast();
    vi.useRealTimers();
    // Undoes vi.spyOn spies made inside tests. A spy made at module level or in beforeAll is undone after the first test.
    vi.restoreAllMocks();
    localStorage.clear();
    document.cookie = `${CAMPUS_COOKIE}=; Path=/; Max-Age=0`;
    document.documentElement.removeAttribute(LOW_DATA_ATTR);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  }
});
