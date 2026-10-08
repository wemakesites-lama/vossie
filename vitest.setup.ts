import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import type { FormEvent, ReactNode } from "react";
import { afterEach, vi } from "vitest";
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

// jsdom's <dialog> has no behaviour. Give it the parts our overlays use.
Object.defineProperties(HTMLDialogElement.prototype, {
  open: {
    configurable: true,
    get(this: HTMLDialogElement) {
      return this.hasAttribute("open");
    },
    set(this: HTMLDialogElement, value: boolean) {
      this.toggleAttribute("open", value);
    },
  },
  show: {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  },
  showModal: {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  },
  close: {
    configurable: true,
    value(this: HTMLDialogElement) {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  },
});

// --- Reset shared browser state between tests -------------------------------

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  document.cookie = "vossie_campus=; Path=/; Max-Age=0";
  document.documentElement.removeAttribute("data-low-data");
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});
