import "@testing-library/jest-dom/vitest";

// jsdom defaults navigator.language to "en-US"; pin it so locale-detection
// tests are deterministic regardless of the host machine's browser locale.
Object.defineProperty(window.navigator, "language", { value: "pt-BR", configurable: true });
