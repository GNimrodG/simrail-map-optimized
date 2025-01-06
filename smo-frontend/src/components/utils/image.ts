import { LRUCache } from "lru-cache";

const imageCache = new LRUCache<string, string>({
  max: 100,
  ttl: 1000 * 60 * 60, // 1 hour
});

export function getRoundedImage(src: string) {
  const image = document.createElement("img");

  image.crossOrigin = "anonymous";

  if (imageCache.has(src)) {
    image.src = imageCache.get(src)!;
    return image;
  }

  image.src = src;

  image.onload = function () {
    if (image.src.startsWith("data:")) {
      return;
    }

    // Clip the avatar to a circle
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get 2d context");
    }

    canvas.width = image.width;
    canvas.height = image.height;

    ctx.beginPath();
    // draw a circle
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    image.src = canvas.toDataURL();
    imageCache.set(src, image.src);
  };

  return image;
}
