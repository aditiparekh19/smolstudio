import { Resend } from "resend";
import { env } from "../config.js";

let resend: Resend | null = null;

function getResend() {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!resend) {
    resend = new Resend(env.RESEND_API_KEY);
  }

  return resend;
}

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
) {
  const client = getResend();

  const { error } = await client.emails.send({
    from: env.EMAIL_FROM,
    to: [email],
    subject: "Reset your SmolStudio password",
    html: `
      <div style="margin:0;padding:40px 20px;background:#fffaf4;font-family:Arial,sans-serif;color:#332c28">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #eadfd5;border-radius:24px;padding:40px">
          
          <p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8b7a70">
            SmolStudio
          </p>

          <h1 style="margin:12px 0 0;font-family:Georgia,serif;font-size:32px;font-weight:500;color:#5e473c">
            Reset your password
          </h1>

          <p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#5f554f">
            We received a request to reset your SmolStudio account password.
          </p>

          <p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#5f554f">
            Click the button below to choose a new password.
          </p>

          <div style="margin:32px 0">
            <a
              href="${resetUrl}"
              style="display:inline-block;background:#5e473c;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:999px;font-size:14px"
            >
              Reset password
            </a>
          </div>

          <p style="margin:0;font-size:13px;line-height:1.7;color:#8b7a70">
            This link will expire in 30 minutes and can only be used once.
          </p>

          <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#8b7a70">
            If you didn't request a password reset, you can safely ignore this email.
          </p>

        </div>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
}
