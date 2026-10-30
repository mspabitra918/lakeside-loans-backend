import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

interface BankVerificationEmailParams {
  to: string;
  applicantName: string;
  reference: string;
  verificationUrl: string;
  type: "initial" | "reverification";
  expiresAt: Date;
}

interface ApplicationSubmittedEmailParams {
  to: string;
  applicantName: string;
  reference: string;
  status: string;
}

/**
 * SMTP mail delivery. Configured from the SMTP_* / FROM_* env vars; if those
 * are absent the service stays in "disabled" mode and send() becomes a no-op so
 * local environments without mail credentials still boot.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private fromName = "";
  private fromEmail = "";

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>("SMTP_HOST");
    const port = Number(this.config.get<string>("SMTP_PORT") ?? 587);
    const user = this.config.get<string>("SMTP_USER");
    const pass = this.config.get<string>("SMTP_PASS");
    this.fromEmail = this.config.get<string>("FROM_EMAIL") ?? user ?? "";
    this.fromName = this.config.get<string>("FROM_NAME") ?? "";

    if (!host || !user || !pass) {
      this.logger.warn(
        "SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing); emails will not be sent.",
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      // 465 implies implicit TLS; 587/25 use STARTTLS.
      secure: port === 465,
      auth: { user, pass },
    });
  }

  get isEnabled(): boolean {
    return this.transporter !== null;
  }

  async sendBankVerificationEmail(
    params: BankVerificationEmailParams,
  ): Promise<boolean> {
    const { to, applicantName, reference, verificationUrl, type, expiresAt } =
      params;

    const subject =
      type === "reverification"
        ? "Action required: re-verify your bank details"
        : "Action required: verify your bank details";

    const action = type === "reverification" ? "re-verify" : "verify";
    const expires = expiresAt.toUTCString();

    const text = [
      `Hello ${applicantName},`,
      "",
      `Please ${action} the bank details for your loan application ${reference} by opening the secure link below:`,
      "",
      verificationUrl,
      "",
      `This link expires on ${expires}. If you did not request this, you can ignore this email.`,
      "",
      this.fromName || "ZIPPY Cash",
    ].join("\n");

    const html = this.renderHtml({
      applicantName,
      reference,
      verificationUrl,
      action,
      expires,
    });

    if (!this.transporter) {
      this.logger.warn(
        `SMTP disabled; would have emailed ${to} with link ${verificationUrl}`,
      );
      return false;
    }

    const from = this.fromName
      ? `"${this.fromName}" <${this.fromEmail}>`
      : this.fromEmail;

    await this.transporter.sendMail({ from, to, subject, text, html });
    this.logger.log(`Bank verification email sent to ${to} (${reference}).`);
    return true;
  }

  async sendApplicationSubmittedEmail(
    params: ApplicationSubmittedEmailParams,
  ): Promise<boolean> {
    const { to, applicantName, reference, status } = params;
    const subject = `Application received: ${reference}`;
    const text = [
      `Hello ${applicantName},`,
      "",
      `Your loan application ${reference} was successfully submitted and its current status is ${status}.`,
      "Our team will review your application and contact you with an update. Submission does not guarantee approval.",
      "",
      `Please keep this reference for your records: ${reference}`,
      "",
      this.fromName || "ZIPPY Cash",
    ].join("\n");
    const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;">
            <tr>
              <td style="background:#2563eb;padding:20px 32px;color:#ffffff;font-size:18px;font-weight:bold;">
                ${this.escapeHtml(this.fromName || "ZIPPY Cash")}
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:16px;">Hello ${this.escapeHtml(applicantName)},</p>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
                  Your loan application has been successfully submitted. Its current status is
                  <strong>${this.escapeHtml(status)}</strong>.
                </p>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
                  Our team will review your application and contact you with an update.
                  Submission does not guarantee approval.
                </p>
                <p style="margin:24px 0 8px;font-size:12px;color:#64748b;">Your application reference</p>
                <p style="margin:0;font-size:22px;font-weight:bold;letter-spacing:2px;color:#0f172a;">
                  ${this.escapeHtml(reference)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    if (!this.transporter) {
      this.logger.warn(
        `SMTP disabled; application confirmation email was not sent to ${to} (${reference}).`,
      );
      return false;
    }

    const from = this.fromName
      ? `"${this.fromName}" <${this.fromEmail}>`
      : this.fromEmail;

    await this.transporter.sendMail({ from, to, subject, text, html });
    this.logger.log(`Application confirmation email sent to ${to} (${reference}).`);
    return true;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    });
  }

  private renderHtml(data: {
    applicantName: string;
    reference: string;
    verificationUrl: string;
    action: string;
    expires: string;
  }): string {
    return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#2563eb;padding:20px 32px;color:#ffffff;font-size:18px;font-weight:bold;">
                ${this.fromName || "ZIPPY Cash"}
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:16px;">Hello ${data.applicantName},</p>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
                  Please ${data.action} the bank details for your loan application
                  <strong>${data.reference}</strong> by clicking the button below.
                </p>
                <p style="margin:0 0 28px;">
                  <a href="${data.verificationUrl}"
                     style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:14px;">
                    ${data.action === "re-verify" ? "Re-verify bank details" : "Verify bank details"}
                  </a>
                </p>
                <p style="margin:0 0 8px;font-size:12px;color:#64748b;line-height:1.6;">
                  Or copy and paste this link into your browser:<br/>
                  <a href="${data.verificationUrl}" style="color:#2563eb;word-break:break-all;">${data.verificationUrl}</a>
                </p>
                <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">
                  This link expires on ${data.expires}. If you did not request this, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }
}
