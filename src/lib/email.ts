import "server-only";

export type EmailMessage = { to: string; subject: string; text: string; html?: string };
export type SendResult = { sent: boolean; reason?: "not_configured" | "provider_error" | "suppressed" };

/**
 * Email integration boundary.
 *
 * - EMAIL_PROVIDER=resend + RESEND_API_KEY + EMAIL_FROM: sends through Resend's HTTP API.
 * - "console" (default): local development only — prints the message to the server log.
 *   On a deployed site (VERCEL=1) the console driver sends nothing and logs no content,
 *   so reset links and tokens never end up in production logs.
 *
 * Message bodies are never logged on failure; only the provider status code.
 */
export function emailProvider(): "resend" | "console" | "unknown" {
  const p = (process.env.EMAIL_PROVIDER ?? "console").trim().toLowerCase();
  return p === "resend" || p === "console" ? p : "unknown";
}

const isDeployed = () => process.env.VERCEL === "1";

export function resendConfigured() {
  return !!process.env.RESEND_API_KEY?.trim() && !!process.env.EMAIL_FROM?.trim();
}

/** Whether an email sent now would actually reach the person. */
export function emailDeliveryAvailable(): boolean {
  const p = emailProvider();
  if (p === "resend") return resendConfigured();
  if (p === "console") return !isDeployed();
  return false;
}

/** "a***@gmail.com" — for logs that must not identify the recipient. */
export function maskEmail(email: string) {
  const [u, d] = email.split("@");
  return `${(u ?? "").slice(0, 1)}***@${d ?? ""}`;
}

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const p = emailProvider();
  if (p === "resend") {
    if (!resendConfigured()) {
      console.warn(`[email] resend selected but RESEND_API_KEY/EMAIL_FROM missing; not sent to ${maskEmail(msg.to)}`);
      return { sent: false, reason: "not_configured" };
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.EMAIL_FROM!.trim(), to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.error(`[email] resend responded ${res.status} for ${maskEmail(msg.to)}`);
        return { sent: false, reason: "provider_error" };
      }
      return { sent: true };
    } catch {
      console.error(`[email] resend request failed for ${maskEmail(msg.to)}`);
      return { sent: false, reason: "provider_error" };
    }
  }
  if (p === "console" && !isDeployed()) {
    console.info(`\n[email:console] to=${msg.to}\nsubject: ${msg.subject}\n${msg.text}\n`);
    return { sent: true };
  }
  // Deployed without a provider (or unknown provider): send nothing, log nothing sensitive.
  console.warn(`[email] no email provider configured; "${msg.subject.slice(0, 40)}" not sent to ${maskEmail(msg.to)}`);
  return { sent: false, reason: "suppressed" };
}
