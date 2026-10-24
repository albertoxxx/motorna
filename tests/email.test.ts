/** Email provider boundary: Resend wire format, no secrets in logs, honest availability. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV = { ...process.env };
beforeEach(() => {
  vi.resetModules();
  delete process.env.EMAIL_PROVIDER;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.VERCEL;
});
afterEach(() => {
  process.env = { ...ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const secretLink = "https://motorna.example/ar/auth/reset-password?token=SECRET-TOKEN-123";
const msg = { to: "seller@example.com", subject: "Reset", text: `Open ${secretLink}`, html: `<a href="${secretLink}">x</a>` };

describe("email provider", () => {
  it("sends through Resend with the API key and configured sender", async () => {
    Object.assign(process.env, { EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_test_key", EMAIL_FROM: "MOTORNA <no-reply@mail.example>" });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendEmail, emailDeliveryAvailable } = await import("@/lib/email");
    expect(emailDeliveryAvailable()).toBe(true);
    expect(await sendEmail(msg)).toEqual({ sent: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");
    expect(JSON.parse(String(init.body))).toMatchObject({ from: "MOTORNA <no-reply@mail.example>", to: ["seller@example.com"], subject: "Reset" });
  });

  it("never logs the message body or link when the provider fails", async () => {
    Object.assign(process.env, { EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_test_key", EMAIL_FROM: "a@b.c" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad", { status: 422 })));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendEmail } = await import("@/lib/email");
    expect(await sendEmail(msg)).toEqual({ sent: false, reason: "provider_error" });
    const logged = err.mock.calls.flat().join(" ");
    expect(logged).not.toContain("SECRET-TOKEN");
    expect(logged).not.toContain("seller@example.com");
  });

  it("on a deployed site without a provider, sends nothing and logs no link", async () => {
    process.env.VERCEL = "1";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { sendEmail, emailDeliveryAvailable } = await import("@/lib/email");
    expect(emailDeliveryAvailable()).toBe(false);
    expect(await sendEmail(msg)).toEqual({ sent: false, reason: "suppressed" });
    expect(info).not.toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(" ")).not.toContain("SECRET-TOKEN");
  });

  it("resend without credentials is reported as unavailable, not silently 'sent'", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { sendEmail, emailDeliveryAvailable } = await import("@/lib/email");
    expect(emailDeliveryAvailable()).toBe(false);
    expect(await sendEmail(msg)).toEqual({ sent: false, reason: "not_configured" });
  });
});

describe("templates", () => {
  it("escape user-supplied text in HTML and keep the link in both parts", async () => {
    const { listingRejectedEmail, passwordResetEmail } = await import("@/lib/email-templates");
    const r = listingRejectedEmail("en", "<script>x</script>", "Photos <b>blurry</b>", "https://m.example/edit");
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
    expect(r.text).toContain("Photos <b>blurry</b>");
    const p = passwordResetEmail("ar", secretLink);
    expect(p.text).toContain(secretLink);
    expect(p.html).toContain('dir="rtl"');
  });
});
