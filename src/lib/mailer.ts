import nodemailer from "nodemailer";

// ─── Transporter ─────────────────────────────────────────────────────────────
// Uses Gmail SMTP. Requires EMAIL_USER + EMAIL_PASS (App Password) in .env
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─── Types ───────────────────────────────────────────────────────────────────
export type AlertType = "52W_HIGH" | "52W_LOW" | "TARGET_PRICE";

export interface AlertEmailPayload {
  to: string;
  symbol: string;
  name: string;
  currentPrice: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  alertType: AlertType;
}

// ─── HTML Email Template ──────────────────────────────────────────────────────
function buildEmailHTML(payload: AlertEmailPayload): string {
  const { symbol, name, currentPrice, fiftyTwoWeekHigh, fiftyTwoWeekLow, alertType } = payload;

  let isHigh = false;
  let badge = "";
  let headline = "";
  let description = "";
  let accentColor = "";

  if (alertType === "52W_HIGH") {
    isHigh = true;
    accentColor = "#10b981";
    badge = "🚀 52-Week HIGH";
    headline = `${name} is at a 52-week HIGH!`;
    description = `The stock is trading at or above its 52-week high — a potential breakout signal.`;
  } else if (alertType === "52W_LOW") {
    isHigh = false;
    accentColor = "#ef4444";
    badge = "🔻 52-Week LOW";
    headline = `${name} is near a 52-week LOW!`;
    description = `The stock is trading at or near its 52-week low — a potential support or risk level.`;
  } else if (alertType === "TARGET_PRICE") {
    isHigh = true; // Use positive highlight
    accentColor = "#3b82f6"; // Blue theme for target price
    badge = "🎯 TARGET HIT";
    headline = `${name} hit your target price!`;
    description = `Your custom price target for ${symbol} was just triggered! It is currently crossing the boundary you set.`;
  }

  const fmt = (n: number) =>
    `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Stock Alert — ${symbol}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f,#0f172a);padding:32px 36px;text-align:center;">
            <div style="display:inline-block;background:${accentColor}22;border:1px solid ${accentColor}44;border-radius:8px;padding:6px 16px;margin-bottom:16px;">
              <span style="color:${accentColor};font-size:13px;font-weight:700;letter-spacing:1px;">${badge}</span>
            </div>
            <h1 style="margin:0;color:#f1f5f9;font-size:22px;font-weight:700;">${headline}</h1>
            <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">${description}</p>
          </td>
        </tr>

        <!-- Price Card -->
        <tr>
          <td style="padding:32px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;border:1px solid #334155;overflow:hidden;">
              <tr>
                <td style="padding:20px 24px;text-align:center;border-right:1px solid #334155;">
                  <div style="color:#64748b;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Current Price</div>
                  <div style="color:${accentColor};font-size:28px;font-weight:800;font-family:monospace;">${fmt(currentPrice)}</div>
                  <div style="color:#94a3b8;font-size:13px;font-weight:600;margin-top:4px;">${symbol} · NSE</div>
                </td>
              </tr>
            </table>

            <!-- Stats Row -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
              <tr>
                <td style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:14px 20px;text-align:center;width:48%;">
                  <div style="color:#64748b;font-size:10px;font-weight:600;letter-spacing:1px;margin-bottom:4px;">52-WEEK HIGH</div>
                  <div style="color:#10b981;font-size:16px;font-weight:700;font-family:monospace;">${fmt(fiftyTwoWeekHigh)}</div>
                </td>
                <td width="4%"></td>
                <td style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:14px 20px;text-align:center;width:48%;">
                  <div style="color:#64748b;font-size:10px;font-weight:600;letter-spacing:1px;margin-bottom:4px;">52-WEEK LOW</div>
                  <div style="color:#ef4444;font-size:16px;font-weight:700;font-family:monospace;">${fmt(fiftyTwoWeekLow)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 36px 32px;text-align:center;">
            <a href="https://nifty-test-2.vercel.app/stock/${encodeURIComponent(symbol)}"
               style="display:inline-block;background:${accentColor};color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;">
              View ${symbol} →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid #334155;text-align:center;">
            <p style="margin:0;color:#475569;font-size:11px;">
              You received this alert because you subscribed to stock alerts on <strong style="color:#64748b;">SwiftHub Markets</strong>.<br/>
              Manage your alerts at <a href="https://nifty-test-2.vercel.app/alerts" style="color:#3b82f6;">nifty-test-2.vercel.app/alerts</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Send Alert Email ─────────────────────────────────────────────────────────
export async function sendAlertEmail(payload: AlertEmailPayload): Promise<void> {
  const { to, symbol, alertType } = payload;
  let subject = "";
  if (alertType === "52W_HIGH") subject = `🚀 ${symbol} hit a 52-Week HIGH!`;
  else if (alertType === "52W_LOW") subject = `🔔 ${symbol} is near a 52-Week LOW`;
  else if (alertType === "TARGET_PRICE") subject = `🎯 ${symbol} Hit Your Target Price!`;

  await transporter.sendMail({
    from: `"SwiftHub Markets 📈" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: buildEmailHTML(payload),
  });
}

// ─── Send Password Reset Email ────────────────────────────────────────────────
export async function sendPasswordResetEmail(to: string, resetLink: string, userName: string): Promise<void> {
  const subject = "Reset your SwiftHub Markets Password";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
        <tr>
          <td style="background:linear-gradient(135deg,#3b82f6,#1e3a5f);padding:32px 36px;text-align:center;">
            <h1 style="margin:0;color:#f1f5f9;font-size:24px;font-weight:700;">Password Reset Request</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;color:#cbd5e1;font-size:16px;line-height:1.6;">
            <p>Hello ${userName},</p>
            <p>We received a request to reset your password for your SwiftHub Markets account. If you didn't initiate this request, you can safely ignore this email.</p>
            <p style="text-align:center;margin:32px 0;">
              <a href="${resetLink}" style="display:inline-block;background:#3b82f6;color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;">
                Reset Password
              </a>
            </p>
            <p>For security, this link will expire in 1 hour.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 36px;border-top:1px solid #334155;text-align:center;">
            <p style="margin:0;color:#475569;font-size:12px;">
              SwiftHub Markets Security Team<br/>
              If you're having trouble clicking the button, copy and paste this link into your web browser:
              <br/><br/>
              <span style="color:#3b82f6;word-break:break-all;">${resetLink}</span>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"SwiftHub Markets Security 🔒" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

