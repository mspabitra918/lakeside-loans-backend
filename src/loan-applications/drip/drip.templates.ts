/**
 * Bank-verification drip sequence.
 *
 * Each step nudges the applicant to finish Verify my bank verification — there
 * is never a request for a banking username or password. The worker stops the
 * whole sequence the moment the verification record flips to "verified".
 */

export const COLOR = {
  brand: "#2563eb",
  warning: "#d97706",
  danger: "#dc2626",
  muted: "#64748b",
} as const;

export const CONTACT = {
  website: process.env.FRONTEND_URL ?? "https://zippycash.online",
  local: { display: "(747) 202-9713", tel: "+17472029713" },
} as const;

export type DripCtaTarget = "verify" | "phone";

export interface DripTemplate {
  subject: string;
  previewText: string;
  label: string;
  tone: string;
  title: string;
  body: string[];
  cta: { label: string; target: DripCtaTarget };
}

// Step 1 — 6 hours
const FOLLOWUP_6H: DripTemplate = {
  subject: "Reminder: Complete Your Bank Verification",
  previewText: "Please complete bank verification to finish your application.",
  label: "Reminder",
  tone: COLOR.brand,
  title: "Complete your bank verification",
  body: [
    "Your loan application is still waiting for bank verification.",
    "Please complete your verification to continue.",
    "If verification is not completed within 2 days, your application may be cancelled.",
  ],
  cta: { label: "Verify my bank", target: "verify" },
};

// Step 2 — 24 hours
const FOLLOWUP_24H: DripTemplate = {
  subject: "Your Bank Verification is Still Incomplete",
  previewText: "Complete your bank verification to continue your application.",
  label: "Action required",
  tone: COLOR.warning,
  title: "Your bank verification is still incomplete",
  body: [
    "Your bank verification is still incomplete.",
    "Please complete verification to continue your loan application.",
  ],
  cta: { label: "Verify my bank", target: "verify" },
};

// Step 3 — 48 hours
const FOLLOWUP_48H: DripTemplate = {
  subject: "Final Reminder: Verify Your Bank Account",
  previewText: "Final reminder: your bank verification is still pending.",
  label: "Final reminder",
  tone: COLOR.danger,
  title: "Final reminder: verify your bank account",
  body: [
    "This is your final reminder to complete your bank verification.",
    "Your application is still pending verification.",
    "If verification is not completed, your application will be cancelled for now.",
  ],
  cta: { label: "Verify my bank", target: "verify" },
};

// Step 4 — 72 hours (cancellation)
const APPLICATION_CANCELLED: DripTemplate = {
  subject: "Notice: Your Loan Application Has Been Cancelled",
  previewText:
    "Your application was cancelled because bank verification was not completed.",
  label: "Application cancelled",
  tone: COLOR.muted,
  title: "Your application has been cancelled",
  body: [
    "Your loan application has been cancelled for now because bank verification was not completed.",
    "You can contact us within 30 days if you would like to request that your application be reopened.",
  ],
  cta: { label: `Call ${CONTACT.local.display}`, target: "phone" },
};

/** Drip step number → template. */
export const DRIP_TEMPLATES: Record<number, DripTemplate> = {
  1: FOLLOWUP_6H,
  2: FOLLOWUP_24H,
  3: FOLLOWUP_48H,
  4: APPLICATION_CANCELLED,
};

/** The final step cancels the application. */
export const DRIP_CANCEL_STEP = 4;

// const HOUR = 60 * 60 * 1000;

// /**
//  * Delay from enqueue time to each step firing. In test mode (DRIP_TEST_MODE=
//  * "true") the whole sequence is compressed to seconds so the "dummy" flow can
//  * be exercised end-to-end without waiting hours.
//  */
// export function dripDelaysMs(): Record<number, number> {
//   if (process.env.DRIP_TEST_MODE === "true") {
//     return { 1: 10_000, 2: 20_000, 3: 30_000, 4: 40_000 };
//   }
//   return { 1: 6 * HOUR, 2: 24 * HOUR, 3: 48 * HOUR, 4: 72 * HOUR };
// }

const HOUR = 60 * 60 * 1000; // Fixed the multiplier to 1,000 ms per second

/**
- Delay from enqueue time to each step firing. In test mode (DRIP_TEST_MODE=
- "true") the whole sequence is compressed to seconds/minutes so the "dummy" flow can
- be exercised end-to-end without waiting hours.
 */
export function dripDelaysMs(): Record<number, number> {
  if (process.env.DRIP_TEST_MODE === "true") {
    const MINUTE = 60 * 1000; // 1 minute in milliseconds
    return { 1: 1 * MINUTE, 2: 2 * MINUTE, 3: 3 * MINUTE, 4: 4 * MINUTE };
  }
  return { 1: 6 * HOUR, 2: 24 * HOUR, 3: 48 * HOUR, 4: 72 * HOUR };
}
