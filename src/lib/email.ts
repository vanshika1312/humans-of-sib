import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM ?? "Humans of SIB <no-reply@humansofsib.com>";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://humansofsib.com";

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

  await resend.emails.send({
    from:    FROM,
    to,
    subject: `⚠️ Incentive Payout Reminder – ${monthLabel} (${unpaidSheets.length} unpaid)`,
    html,
  });
}
