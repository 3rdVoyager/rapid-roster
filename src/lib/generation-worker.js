import { generateRoster } from "./generator.js";

function shuffle(records) {
  const shuffled = [...records];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

self.addEventListener("message", ({ data }) => {
  try {
    const result = generateRoster({
      ...data,
      items: shuffle(data.items),
      slots: shuffle(data.slots),
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
