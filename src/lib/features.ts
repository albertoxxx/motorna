/**
 * Feature switches for capabilities that aren't built yet.
 * The UI only shows an entry point once the feature actually works.
 */
export const features = {
  assistant: process.env.NEXT_PUBLIC_FEATURE_ASSISTANT === "1",
} as const;
