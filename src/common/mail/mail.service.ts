import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/sequelize";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { EmailLog } from "./email-log.model";

interface BankVerificationEmailParams {
  to: string;
  applicantName: string;
  reference: string;
  verificationUrl: string;
  type: "initial" | "reverification";
  expiresAt: Date;
  alwaysSend?: boolean;
}

interface ApplicationSubmittedEmailParams {
  to: string;
  applicantName: string;
  reference: string;
  status: string;
  verifyLink?: string; // Added verifyLink parameter
}

interface DripEmailParams {
  to: string;
  applicantName: string;
  reference: string;
  subject: string;
  step: number;
  previewText: string;
  label: string;
  tone: string;
  title: string;
  body: string[];
  ctaLabel: string;
  ctaHref: string;
}

interface EmailDelivery {
  emailType: string;
  to: string;
  reference: string;
  subject: string;
  text: string;
  html: string;
  alwaysSend?: boolean;
}

/**
 * SMTP mail delivery. Configured from the SMTP_* / FROM_* env vars; if those
 * are absent the service stays in "disabled" mode and records delivery attempts
 * as skipped so local environments without mail credentials still boot.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private fromName = "";
  private fromEmail = "";

  constructor(
    private readonly config: ConfigService,
    @InjectModel(EmailLog)
    private readonly emailLogs: typeof EmailLog,
  ) {}

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
      // Fail fast instead of blocking the HTTP request. Without these, a
      // stalled SMTP connection (common from a VPS whose outbound 587/465 is
      // throttled) hangs `sendMail` until nginx's proxy_read_timeout fires and
      // returns a 504 — even though the application row is already saved.
      connectionTimeout: 10000, // TCP connect
      greetingTimeout: 10000, // wait for the server banner
      socketTimeout: 15000, // inactivity on the socket
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

    return this.deliverEmail({
      emailType: `bank_verification_${type}`,
      to,
      reference,
      subject,
      text,
      html,
      alwaysSend: type === "reverification" && params.alwaysSend,
    });
  }

  //   async sendApplicationSubmittedEmail(
  //     params: ApplicationSubmittedEmailParams,
  //   ): Promise<boolean> {
  //     const { to, applicantName, reference, status } = params;
  //     const subject = `Application received: ${reference}`;
  //     const text = [
  //       `Hello ${applicantName},`,
  //       "",
  //       `Your loan application ${reference} was successfully submitted and its current status is ${status}.`,
  //       "Our team will review your application and contact you with an update. Submission does not guarantee approval.",
  //       "",
  //       `Please keep this reference for your records: ${reference}`,
  //       "",
  //       this.fromName || "ZIPPY Cash",
  //     ].join("\n");
  //     const html = `<!doctype html>
  // <html>
  //   <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  //     <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  //       <tr>
  //         <td align="center">
  //           <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;">
  //             <tr>
  //               <td style="background:#2563eb;padding:20px 32px;color:#ffffff;font-size:18px;font-weight:bold;">
  //                 ${this.escapeHtml(this.fromName || "ZIPPY Cash")}
  //               </td>
  //             </tr>
  //             <tr>
  //               <td style="padding:32px;">
  //                 <p style="margin:0 0 16px;font-size:16px;">Hello ${this.escapeHtml(applicantName)},</p>
  //                 <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
  //                   Your loan application has been successfully submitted. Its current status is
  //                   <strong>${this.escapeHtml(status)}</strong>.
  //                 </p>
  //                 <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
  //                   Our team will review your application and contact you with an update.
  //                   Submission does not guarantee approval.
  //                 </p>
  //                 <p style="margin:24px 0 8px;font-size:12px;color:#64748b;">Your application reference</p>
  //                 <p style="margin:0;font-size:22px;font-weight:bold;letter-spacing:2px;color:#0f172a;">
  //                   ${this.escapeHtml(reference)}
  //                 </p>
  //               </td>
  //             </tr>
  //           </table>
  //         </td>
  //       </tr>
  //     </table>
  //   </body>
  // </html>`;

  //     if (!this.transporter) {
  //       this.logger.warn(
  //         `SMTP disabled; application confirmation email was not sent to ${to} (${reference}).`,
  //       );
  //       return false;
  //     }

  //     const from = this.fromName
  //       ? `"${this.fromName}" <${this.fromEmail}>`
  //       : this.fromEmail;

  //     await this.transporter.sendMail({ from, to, subject, text, html });
  //     this.logger.log(
  //       `Application confirmation email sent to ${to} (${reference}).`,
  //     );
  //     return true;
  //   }

  async sendApplicationSubmittedEmail(
    params: ApplicationSubmittedEmailParams,
  ): Promise<boolean> {
    const { to, applicantName, reference, status, verifyLink } = params;
    const subject = `Application received: ${reference} - Action Required`;

    const text = [
      `Hello ${applicantName},`,
      "",
      `Your loan application ${reference} was successfully submitted and its current status is ${status}.`,
      "To proceed with your application, please complete your bank verification using the link below:",
      verifyLink || "",
      "",
      "Our team will review your application and contact you with an update. Submission does not guarantee approval.",
      "",
      `Please keep this reference for your records: ${reference}`,
      "",
      this.fromName || "ZIPPY Cash",
    ]
      .filter(Boolean)
      .join("\n");

    const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
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
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#334155;">
                  Please complete your <strong>bank verification</strong> to continue processing your application. If verification is not completed, your application may be delayed or cancelled.
                </p>
                
                ${
                  verifyLink
                    ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                        <tr>
                          <td align="center" style="border-radius:8px;background:#2563eb;">
                            <a href="${this.escapeHtml(verifyLink)}" target="_blank" style="font-size:14px;font-family:Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;border:1px solid #2563eb;display:inline-block;font-weight:bold;">
                              Verify my bank
                            </a>
                          </td>
                        </tr>
                      </table>`
                    : ""
                }

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

    return this.deliverEmail({
      emailType: "application_submitted",
      to,
      reference,
      subject,
      text,
      html,
    });
  }

  /** Render + send one bank-verification drip step. */
  async sendDripEmail(params: DripEmailParams): Promise<boolean> {
    const {
      to,
      applicantName,
      reference,
      subject,
      step,
      previewText,
      label,
      tone,
      title,
      body,
      ctaLabel,
      ctaHref,
    } = params;

    const text = [
      `Hello ${applicantName},`,
      "",
      title,
      "",
      ...body,
      "",
      `${ctaLabel}: ${ctaHref}`,
      "",
      `Application reference: ${reference}`,
      "",
      this.fromName || "ZIPPY Cash",
    ].join("\n");

    const paragraphs = body
      .map(
        (line) =>
          `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155;">${this.escapeHtml(
            line,
          )}</p>`,
      )
      .join("");

    const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <span style="display:none;max-height:0;overflow:hidden;">${this.escapeHtml(previewText)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:${tone};padding:20px 32px;color:#ffffff;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">
                ${this.escapeHtml(label)}
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:16px;">Hello ${this.escapeHtml(applicantName)},</p>
                <h1 style="margin:0 0 16px;font-size:18px;color:#0f172a;">${this.escapeHtml(title)}</h1>
                ${paragraphs}
                <p style="margin:24px 0 8px;">
                  <a href="${ctaHref}"
                     style="display:inline-block;background:${tone};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:14px;">
                    ${this.escapeHtml(ctaLabel)}
                  </a>
                </p>
                <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">
                  Application reference: ${this.escapeHtml(reference)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    return this.deliverEmail({
      emailType: `bank_verification_drip_step_${step}`,
      to,
      reference,
      subject,
      text,
      html,
    });
  }

  private async deliverEmail({
    emailType,
    to,
    reference,
    subject,
    text,
    html,
    alwaysSend = false,
  }: EmailDelivery): Promise<boolean> {
    const existingLog = alwaysSend
      ? null
      : await this.emailLogs.findOne({
          where: { emailType, applicationReference: reference },
        });
    if (!alwaysSend && existingLog?.status === "sent") {
      this.logger.log(
        `Skipping duplicate email "${subject}" for ${reference}; it is already recorded as sent.`,
      );
      return true;
    }

    const log = alwaysSend
      ? await this.emailLogs.create({
          emailType,
          recipient: to,
          applicationReference: reference,
          subject,
          status: "pending",
        })
      : existingLog ??
        (await this.emailLogs.create({
            emailType,
            recipient: to,
            applicationReference: reference,
            subject,
            status: "pending",
        }));
    await log.update({
      recipient: to,
      subject,
      status: "pending",
      sentAt: null,
      errorMessage: null,
    });

    if (!this.transporter) {
      await log.update({
        status: "skipped",
        errorMessage: "SMTP is not configured.",
      });
      this.logger.warn(
        `SMTP disabled; email "${subject}" was not sent to ${to} (${reference}).`,
      );
      return false;
    }

    const from = this.fromName
      ? `"${this.fromName}" <${this.fromEmail}>`
      : this.fromEmail;

    try {
      await this.transporter.sendMail({ from, to, subject, text, html });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown email delivery error";
      await log.update({ status: "failed", errorMessage });
      this.logger.error(
        `Email "${subject}" failed for ${to} (${reference}): ${errorMessage}`,
      );
      throw error;
    }

    await log.update({
      status: "sent",
      sentAt: new Date(),
      errorMessage: null,
    });
    this.logger.log(`Email "${subject}" sent to ${to} (${reference}).`);
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
