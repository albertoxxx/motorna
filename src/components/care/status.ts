/** Badge tone per center status (server- and client-safe). */
export const careStatusTone = (s: string) =>
  (({ approved: "success", applied: "warning", under_review: "brand", rejected: "danger", suspended: "danger", revoked: "dark" }) as const)[
    s as "approved"
  ] ?? ("neutral" as const);
