import "server-only";

/**
 * SMS integration boundary (phone verification codes only).
 *
 * - SMS_PROVIDER=twilio + TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM (or TWILIO_MESSAGING_SERVICE_SID):
 *   sends through Twilio's Messages API.
 * - "console": local development only — prints the code to the server log. Never on a deployed site.
 * - unset (default): phone verification is not offered anywhere in the UI.
 *
 * Message bodies (which contain codes) are never logged in production.
 */
export type SmsResult = { sent: boolean; reason?: "not_configured" | "provider_error" };

const isDeployed = () => process.env.VERCEL === "1";
const env = (k: string) => process.env[k]?.trim() ?? "";

export function smsProvider(): "twilio" | "console" | "none" {
  const p = env("SMS_PROVIDER").toLowerCase();
  return p === "twilio" || p === "console" ? p : "none";
}

function twilioConfigured() {
  return !!env("TWILIO_ACCOUNT_SID") && !!env("TWILIO_AUTH_TOKEN") && (!!env("TWILIO_FROM") || !!env("TWILIO_MESSAGING_SERVICE_SID"));
}

/** Whether a code sent now would actually reach the person. The UI offers verification only when true. */
export function smsDeliveryAvailable(): boolean {
  const p = smsProvider();
  if (p === "twilio") return twilioConfigured();
  if (p === "console") return !isDeployed();
  return false;
}

/** "010*****678" for logs. */
export const maskPhone = (p: string) => (p.length > 6 ? `${p.slice(0, 3)}*****${p.slice(-3)}` : "***");

/** Egyptian mobile "01XXXXXXXXX" → "+201XXXXXXXXX". */
export const toE164 = (local: string) => `+20${local.replace(/^0/, "")}`;

export async function sendSms(toLocal: string, text: string): Promise<SmsResult> {
  const p = smsProvider();
  if (p === "console") {
    if (isDeployed()) return { sent: false, reason: "not_configured" };
    console.info(`[sms:console] to ${toLocal}: ${text}`);
    return { sent: true };
  }
  if (p !== "twilio" || !twilioConfigured()) return { sent: false, reason: "not_configured" };
  const sid = env("TWILIO_ACCOUNT_SID");
  const body = new URLSearchParams({ To: toE164(toLocal), Body: text });
  if (env("TWILIO_MESSAGING_SERVICE_SID")) body.set("MessagingServiceSid", env("TWILIO_MESSAGING_SERVICE_SID"));
  else body.set("From", env("TWILIO_FROM"));
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${env("TWILIO_AUTH_TOKEN")}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[sms] twilio responded ${res.status} for ${maskPhone(toLocal)}`);
      return { sent: false, reason: "provider_error" };
    }
    return { sent: true };
  } catch {
    console.error(`[sms] twilio request failed for ${maskPhone(toLocal)}`);
    return { sent: false, reason: "provider_error" };
  }
}
