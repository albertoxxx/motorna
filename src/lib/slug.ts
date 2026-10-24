const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function shortId(len = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** SEO-friendly, unique listing slug: 2019-toyota-corolla-k3m9xq */
export function makeListingSlug(year: number, makeSlug: string, modelSlug: string) {
  return `${year}-${makeSlug}-${modelSlug}-${shortId()}`.toLowerCase();
}
