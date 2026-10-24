import "server-only";

export type EmailMessage = { to: string; subject: string; text: string };

/**
 * Email integration boundary.
 * - "console" (default, dev): prints the message to the server log.
 * - Production providers (Resend/SMTP) are not wired yet; sending fails loudly
 *   instead of pretending the email went out.
 */
export async function sendEmail(msg: EmailMessage): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER ?? "console";
  if (provider === "console") {
    console.info(`\n[email:console] to=${msg.to}\nsubject: ${msg.subject}\n${msg.text}\n`);
    return;
  }
  throw new Error(`Email provider "${provider}" is not configured. See docs/SETUP.md.`);
}
