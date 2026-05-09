import { Resend } from "resend";

const FROM = (process.env.EMAIL_FROM ?? "Humans of SIB <no-reply@humansofsib.com>").trim();
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://humansofsib.com";

/** `resend` (default) or `brevo` — https://developers.brevo.com/reference/send-transac-email */
function emailProvider(): "resend" | "brevo" {
  const p = (process.env.EMAIL_PROVIDER ?? "resend").trim().toLowerCase();
  return p === "brevo" ? "brevo" : "resend";
}

function parseFromHeader(from: string): { name?: string; email: string } {
  const m = from.trim().match(/^(.+?)\s*<([^>]+)>$/);
  if (m) return { name: m[1]!.trim().replace(/^"|"$/g, ""), email: m[2]!.trim() };
  return { email: from.trim() };
}

/** Trim + strip a single pair of surrounding quotes (common .env mistake). */
function normalizeEnvSecret(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  let s = value.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s || undefined;
}

async function sendHtmlEmail(params: { to: string; subject: string; html: string }) {
  const provider = emailProvider();
  if (provider === "brevo") {
    const key = normalizeEnvSecret(process.env.BREVO_API_KEY);
    if (!key) throw new Error("BREVO_API_KEY is required when EMAIL_PROVIDER=brevo");
    const sender = parseFromHeader(FROM);
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": key,
      },
      body: JSON.stringify({
        sender: { email: sender.email, ...(sender.name ? { name: sender.name } : {}) },
        to: [{ email: params.to }],
        subject: params.subject,
        htmlContent: params.html,
      }),
    });
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      let detail = raw.slice(0, 500);
      try {
        const j = JSON.parse(raw) as { message?: string; error?: { message?: string } };
        const m = j.message ?? j.error?.message;
        if (m) detail = m;
      } catch {
        /* keep raw */
      }
      throw new Error(`Brevo transactional send failed (${res.status}): ${detail}`);
    }
    return;
  }

  const key = normalizeEnvSecret(process.env.RESEND_API_KEY);
  if (!key) throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER is resend or unset");
  const resend = new Resend(key);
  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}

export interface UnpaidSheet {
  counsellorName: string;
  team:           string | null;
  cluster:        string | null;
  finalAmount:    number;
  status:         string;
}

export async function sendIncentiveReminderEmail({
  to,
  recipientName,
  monthLabel,
  unpaidSheets,
}: {
  to:            string;
  recipientName: string;
  monthLabel:    string;   // e.g. "April 2026"
  unpaidSheets:  UnpaidSheet[];
}) {
  const total = unpaidSheets.reduce((a, s) => a + s.finalAmount, 0);
  const rows  = unpaidSheets
    .map(
      (s) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${s.counsellorName}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#666">${s.team ?? "—"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#666">${s.cluster ?? "—"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:600">₹${s.finalAmount.toLocaleString("en-IN")}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">
            <span style="background:${s.status === "APPROVED" ? "#f0fdf4" : "#fffbeb"};color:${s.status === "APPROVED" ? "#15803d" : "#b45309"};padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600">
              ${s.status}
            </span>
          </td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">

        <!-- Header -->
        <tr>
          <td style="background:#1a1a2e;padding:24px 32px">
            <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">💰 Incentive Payout Reminder</h1>
            <p style="margin:4px 0 0;color:#9ca3af;font-size:14px">${monthLabel} · ${unpaidSheets.length} counsellor${unpaidSheets.length !== 1 ? "s" : ""} unpaid</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px">
            <p style="margin:0 0 16px;color:#374151;font-size:15px">Hi ${recipientName},</p>
            <p style="margin:0 0 20px;color:#374151;font-size:15px">
              The following counsellors have <strong>not yet received their incentive payout</strong> for
              <strong>${monthLabel}</strong>. Payouts were due by the 15th of this month.
            </p>

            <!-- Table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:13px">
              <thead>
                <tr style="background:#f9fafb">
                  <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">Counsellor</th>
                  <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">Team</th>
                  <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">Cluster</th>
                  <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">Amount</th>
                  <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">Status</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
              <tfoot>
                <tr style="background:#f9fafb">
                  <td colspan="3" style="padding:10px 12px;font-weight:700;color:#374151">Total Outstanding</td>
                  <td colspan="2" style="padding:10px 12px;font-weight:700;color:#374151">₹${total.toLocaleString("en-IN")}</td>
                </tr>
              </tfoot>
            </table>

            <!-- CTA -->
            <div style="margin-top:24px">
              <a href="${BASE_URL}/incentives?tab=payment"
                 style="display:inline-block;background:#1a1a2e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">
                View Payment Status →
              </a>
            </div>

            <p style="margin:24px 0 0;color:#9ca3af;font-size:13px">
              This is an automated reminder from the Humans of SIB platform.
              Please process outstanding payouts or reach out to the Accounts team.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendHtmlEmail({
    to,
    subject: `⚠️ Incentive Payout Reminder – ${monthLabel} (${unpaidSheets.length} unpaid)`,
    html,
  });
}

// ─── Weekly performance email (sent every Monday to each counsellor) ──────────

export interface WeeklyPerformanceData {
  counsellorName:  string;
  monthLabel:      string;   // e.g. "April 2026"
  weekNumber:      number;   // week of month (1–5)
  revenue:         number;   // revenue so far this month
  target:          number;   // monthly target
  incentiveEst:    number;   // estimated incentive so far
  slabRate:        number;   // current slab rate %
  daysLeft:        number;   // calendar days left in the month
}

function motivationalCopy(pct: number, daysLeft: number): { headline: string; body: string; tips: string[] } {
  if (pct >= 100) return {
    headline: "🎯 You've crushed your target!",
    body: "Every rupee above target this month is pure upside. Keep the momentum — end the month strong and set the bar for next month.",
    tips: [
      "Follow up on any warm leads before month-end",
      "Lock in referrals from happy students",
      "Help a teammate close — team wins matter too",
    ],
  };
  if (pct >= 80) return {
    headline: "🔥 You're so close — finish strong!",
    body: `You're at ${pct}% of your target with ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left. A strong push this week and you'll get there.`,
    tips: [
      "Prioritise your hottest leads first thing each morning",
      "Re-engage leads who went cold in the last 2 weeks",
      "Block 2 focused hours daily just for follow-ups",
    ],
  };
  if (pct >= 50) return {
    headline: "💪 Halfway there — time to accelerate!",
    body: `You've hit ${pct}% of your target. With ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left, a consistent push each day will get you over the line.`,
    tips: [
      "Reach out to at least 10 new prospects this week",
      "Ask existing students for 1 referral each",
      "Review your pipeline — identify stalled leads and re-engage",
    ],
  };
  return {
    headline: "🚀 Let's get the engine running!",
    body: `You're at ${pct}% of your target. The month is still very much winnable — every conversation counts. Let's make this week count.`,
    tips: [
      "Start each day with a clear list of 5 people to call",
      "Don't overthink — send that follow-up message now",
      "Talk to your manager about any blockers you're facing",
      "Celebrate small wins — each enrolment is progress",
    ],
  };
}

export async function sendWeeklyPerformanceEmail({
  to,
  data,
}: {
  to:   string;
  data: WeeklyPerformanceData;
}) {
  const pct      = data.target > 0 ? Math.min(Math.round((data.revenue / data.target) * 100), 999) : 0;
  const gap      = Math.max(0, data.target - data.revenue);
  const { headline, body, tips } = motivationalCopy(pct, data.daysLeft);

  const barWidth  = Math.min(100, pct);
  const barColor  = pct >= 100 ? "#16a34a" : pct >= 80 ? "#f59e0b" : pct >= 50 ? "#f97316" : "#ef4444";

  const tipRows = tips
    .map((t) => `<li style="margin:6px 0;color:#374151;font-size:14px">✦ ${t}</li>`)
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;max-width:600px">

        <!-- Header gradient -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f 0%,#0ea5e9 100%);padding:32px">
            <p style="margin:0 0 4px;color:#bae6fd;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">
              Week ${data.weekNumber} · ${data.monthLabel}
            </p>
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;line-height:1.2">
              ${headline}
            </h1>
            <p style="margin:10px 0 0;color:#e0f2fe;font-size:15px">
              Hey ${data.counsellorName.split(" ")[0]}, here's your performance update.
            </p>
          </td>
        </tr>

        <!-- Cha-Ching Meter -->
        <tr>
          <td style="padding:28px 32px 0">
            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em">
              🎰 Cha-Ching Meter
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:13px;color:#6b7280">₹0</td>
                <td style="text-align:right;font-size:13px;color:#6b7280">Target: ₹${data.target.toLocaleString("en-IN")}</td>
              </tr>
            </table>
            <!-- Progress bar -->
            <div style="margin:6px 0 8px;background:#f3f4f6;border-radius:999px;height:14px;overflow:hidden">
              <div style="background:${barColor};width:${barWidth}%;height:100%;border-radius:999px;transition:width 0.3s"></div>
            </div>
            <p style="margin:0;font-size:22px;font-weight:800;color:#111827">
              ${pct}% achieved
              ${pct >= 100 ? '<span style="font-size:14px;font-weight:500;color:#16a34a;margin-left:8px">✓ Target hit!</span>' : `<span style="font-size:14px;font-weight:500;color:#6b7280;margin-left:8px">₹${gap.toLocaleString("en-IN")} to go</span>`}
            </p>
          </td>
        </tr>

        <!-- Stats row -->
        <tr>
          <td style="padding:20px 32px">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
              <tr style="background:#f9fafb">
                <td style="padding:14px 16px;text-align:center;border-right:1px solid #e5e7eb">
                  <div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.06em">Revenue</div>
                  <div style="font-size:20px;font-weight:800;color:#111827;margin-top:4px">₹${data.revenue.toLocaleString("en-IN")}</div>
                </td>
                <td style="padding:14px 16px;text-align:center;border-right:1px solid #e5e7eb">
                  <div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.06em">Est. Incentive</div>
                  <div style="font-size:20px;font-weight:800;color:#0ea5e9;margin-top:4px">₹${data.incentiveEst.toLocaleString("en-IN")}</div>
                  ${data.slabRate > 0 ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px">@ ${data.slabRate}%</div>` : ""}
                </td>
                <td style="padding:14px 16px;text-align:center">
                  <div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.06em">Days Left</div>
                  <div style="font-size:20px;font-weight:800;color:#111827;margin-top:4px">${data.daysLeft}</div>
                  <div style="font-size:11px;color:#9ca3af;margin-top:2px">in ${data.monthLabel.split(" ")[0]}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Motivational message -->
        <tr>
          <td style="padding:0 32px 20px">
            <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;border-radius:0 8px 8px 0;padding:16px 20px">
              <p style="margin:0;color:#0c4a6e;font-size:15px;line-height:1.6">${body}</p>
            </div>
          </td>
        </tr>

        <!-- Tips -->
        <tr>
          <td style="padding:0 32px 28px">
            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.06em">
              💡 This week, focus on
            </p>
            <ul style="margin:0;padding:0 0 0 4px;list-style:none">
              ${tipRows}
            </ul>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 32px 32px">
            <a href="${BASE_URL}/incentives"
               style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:0.02em">
              View My Dashboard →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px">
            <p style="margin:0;color:#9ca3af;font-size:12px">
              You're receiving this because you're part of the Skillinabox sales team.
              Sent every Monday by Humans of SIB.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendHtmlEmail({
    to,
    subject: `${headline} — Week ${data.weekNumber}, ${data.monthLabel}`,
    html,
  });
}

export async function sendEmployeeOnboardingInvite({
  to,
  employeeCode,
  firstName,
  inviteUrl,
}: {
  to: string;
  employeeCode: string;
  firstName: string;
  inviteUrl: string;
}) {
  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#f4f4f5">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
        <tr><td style="padding:28px 28px 8px">
          <p style="margin:0;font-size:18px;font-weight:700;color:#111827">Welcome to Humans of SIB</p>
          <p style="margin:12px 0 0;font-size:14px;color:#6b7280;line-height:1.5">
            Hi ${firstName}, your profile has been set up. Your employee ID is <strong>${employeeCode}</strong>.
            Complete your details to access the workspace — this link expires in 14 days.
          </p>
        </td></tr>
        <tr><td style="padding:8px 28px 28px">
          <a href="${inviteUrl}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600">
            Complete your onboarding
          </a>
          <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;word-break:break-all">
            If the button doesn’t work, copy this link:<br />${inviteUrl}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  await sendHtmlEmail({
    to,
    subject: "Complete your Humans of SIB onboarding",
    html,
  });
}
