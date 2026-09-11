import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
export const samples = [
  {
    name: "Garden bowl",
    caption: "A little bit of everything good.",
    url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1200&h=1200&fit=crop&q=75&fm=jpg",
    credit: "Anna Pelzer",
    link: "https://unsplash.com/photos/IGfIGP5ONV0",
  },
  {
    name: "Sunday pancakes",
    caption: "Blueberries, maple & slow mornings.",
    url: "https://images.unsplash.com/photo-1528301392571-0dfab3c00216?w=1200&h=1200&fit=crop&q=75&fm=jpg",
    credit: "nikldn",
    link: "https://unsplash.com/photos/HzVHlwvQlyw",
  },
  {
    name: "Morning yogurt",
    caption: "Creamy yogurt & a golden crunch.",
    url: "https://images.unsplash.com/photo-1612383277710-67896ecf4c69?w=1200&h=1200&fit=crop&q=75&fm=jpg",
    credit: "Tetiana Bykovets",
    link: "https://unsplash.com/photos/gOCWfZppp6M",
  },
];
export async function preparePhoto(uri: string, width: number, height: number) {
  const ratio = Math.min(
    1,
    1024 / Math.min(width, height),
    2048 / Math.max(width, height),
  );
  const context = ImageManipulator.manipulate(uri);
  context.resize({
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  });
  const rendered = await context.renderAsync();
  const out = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.65,
    base64: true,
  });
  if (!out.base64)
    throw new Error(
      "Could not prepare that photo. Select a JPG or take another photo.",
    );
  if (out.base64.length > 900000)
    throw new Error(
      "The photo is still too large. Crop it closer to your meal and select it again.",
    );
  return `data:image/jpeg;base64,${out.base64}`;
}
