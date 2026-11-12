import { generateRoster } from "./generator.js";

self.addEventListener("message", ({ data }) => {
  try {
    const result = generateRoster({
      ...data,
      onProgress: (progress) => {
        self.postMessage({ type: "progress", progress });
      },
    });
    self.postMessage({ type: "complete", result });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
