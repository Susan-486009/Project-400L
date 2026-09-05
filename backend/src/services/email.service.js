import { Resend } from 'resend';
import { config } from '../config/config.js';

/* ════════════════════════════════════════════════════════════
   email.service.js
   ────────────────────────────────────────────────────────────
   Branded transactional emails delivered via Resend.

   Branding mirrors the LASUSTECH portal:
     Primary  → deep forest green  #123524
     Accent   → champagne gold     #C79A1B
     Fonts    → Playfair Display (display) / Plus Jakarta Sans (body)

   Resilience contract:
     - If RESEND_API_KEY is not configured, all sends are a no-op
       (a warning is logged) and NEVER throw. Email must never
       break a complaint submission or a status update.

   Testing redirect:
     - When config.email.redirectTo is set (e.g. the Resend account
       owner), every outgoing message is redirected to that address.
       The intended recipient is surfaced in the subject + body.
   ════════════════════════════════════════════════════════════ */

let resendClient = null;

function getClient() {
  if (!config.email.enabled) return null;
  if (!resendClient) {
    resendClient = new Resend(config.email.resendApiKey);
  }
  return resendClient;
}

/* ── Brand palette (mirrors frontend styles.css) ───────── */
const BRAND = {
  green:      '#123524',
  greenDeep:  '#0c2418',
  gold:       '#C79A1B',
  goldSoft:   '#E9CB7A',
  bg:         '#f4f6fb',
  card:       '#ffffff',
  text:       '#1f2937',
  muted:      '#6b7280',
  border:     '#e5e7eb',
  fontDisplay: "'Playfair Display', Georgia, 'Times New Roman', serif",
  fontBody: "Plus Jakarta Sans, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

const FOOTER_CONTACTS = [
  { label: 'Helpdesk', value: 'helpdesk@lasustech.ng' },
  { label: 'Phone',     value: '+234 (0) 800 000 0000' },
  { label: 'Location',  value: 'Ikorodu, Lagos State, Nigeria' },
];

/* ── Status styling — recoloured to the brand ───────────── */
const STATUS_STYLES = {
  pending:   { label: 'Pending',    bg: '#FDF3D7', color: '#8a6d1a', border: '#e5c14a' },
  in_review: { label: 'In Review',  bg: '#E3EDF7', color: '#1e4e7a', border: '#5b8db8' },
  resolved:  { label: 'Resolved',   bg: '#DFEFE4', color: '#1e6b3c', border: '#5fa776' },
  fixed:     { label: 'Fixed',      bg: '#DFEFE4', color: '#1e6b3c', border: '#5fa776' },
  rejected:  { label: 'Rejected',   bg: '#FBE4E2', color: '#a2382f', border: '#e07a6f' },
};

function statusPill(status) {
  const s = STATUS_STYLES[status] || { label: status, bg: '#EFF0F2', color: '#4b5563', border: '#c6cbd2' };
  return (
    `<span style="display:inline-block;padding:9px 22px;border-radius:9999px;` +
    `background:${s.bg};color:${s.color};border:1px solid ${s.border};` +
    `font-family:${BRAND.fontBody};font-weight:700;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;">${s.label}</span>`
  );
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── Resolve recipient + prepare redirect notice ────────── */
function resolveRecipient(to) {
  const redirectTo = config.email.redirectTo;
  if (redirectTo) {
    return {
      to: [redirectTo],
      deliverTo: to,
      subjectPrefix: `[to: ${to}] `,
      redirectNote: (
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" ` +
        `style="background:#FDF3D7;border:1px solid ${BRAND.gold};border-radius:10px;margin:0 0 20px 0;">` +
        `<tr><td style="padding:12px 16px;color:#6d5614;font-size:12.5px;line-height:1.5;">` +
        `<strong>Test copy.</strong> This email was redirected from <strong>${escapeHtml(to)}</strong> so it could be ` +
        `delivered during testing. No action is needed on the original recipient's part.</td></tr></table>`
      ),
    };
  }
  return { to: [to], deliverTo: to, subjectPrefix: '', redirectNote: '' };
}

/* ── Shared branded shell ───────────────────────────────── */
function brandedLayout({ preheader, bodyHtml, plainText }) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" />
<title>LASUSTECH Student Resolution Center</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:${BRAND.fontBody};">
<center role="article" aria-roledescription="email" lang="en" style="width:100%;background:${BRAND.bg};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:${BRAND.bg};padding:28px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:${BRAND.card};border-radius:16px;overflow:hidden;border:1px solid ${BRAND.border};box-shadow:0 10px 30px rgba(18,53,36,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.green},${BRAND.greenDeep});padding:8px;padding-bottom:0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="height:4px;background:linear-gradient(90deg,${BRAND.gold},${BRAND.goldSoft},${BRAND.gold});border-radius:4px;"><tr><td></td></tr></table>
            </td>
          </tr>
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.greenDeep},${BRAND.green});padding:28px 32px;color:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td valign="middle" style="padding-right:14px;">
                          <span style="font-size:34px;line-height:1;display:inline-flex;align-items:center;justify-content:center;">🛡</span>
                        </td>
                        <td valign="middle">
                          <div style="font-family:${BRAND.fontBody};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND.goldSoft};font-weight:800;">LASUSTECH</div>
                          <div style="font-family:${BRAND.fontDisplay};font-size:20px;font-weight:800;line-height:1.15;margin-top:3px;">Student Resolution Center</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" valign="middle" style="font-size:26px;line-height:1;">🎓</td>
                </tr>
              </table>
            </td>
          </tr>
          ${preheader ? `<tr><td style="padding:22px 32px 0 32px;color:${BRAND.muted};font-size:12px;line-height:16px;">${escapeHtml(preheader)}</td></tr>` : ''}
          <tr><td style="padding:22px 32px 12px 32px;color:${BRAND.text};font-size:15px;line-height:1.7;font-family:${BRAND.fontBody};">
            ${bodyHtml}
          </td></tr>
          <tr>
            <td style="padding:20px 32px 26px 32px;background:${BRAND.card};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid ${BRAND.border};padding-top:20px;">
                <tr>
                  <td style="color:${BRAND.muted};font-size:12px;line-height:1.8;font-family:${BRAND.fontBody};">
                    <strong style="color:${BRAND.green};">LASUSTECH Student Resolution Center</strong><br/>
                    Lagos State University of Science and Technology<br/>
                    ${FOOTER_CONTACTS.map(c => `${escapeHtml(c.label)}: ${escapeHtml(c.value)}`).join('<br/>')}
                    <div style="margin-top:12px;border-top:1px solid ${BRAND.border};padding-top:12px;color:#9aa1a8;">&copy; ${new Date().getFullYear()} LASUSTECH &middot; All rights reserved.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</center>
</body>
</html>`;

  const footerText = `LASUSTECH STUDENT RESOLUTION CENTER
====================================
Lagos State University of Science and Technology
Helpdesk: helpdesk@lasustech.ng
Phone: +234 (0) 800 000 0000
Location: Ikorodu, Lagos State, Nigeria`;

  const text = `LASUSTECH STUDENT RESOLUTION CENTER
====================================
${plainText}

${footerText}`;

  return { html, text };
}

/* ── Per-status copy ────────────────────────────────────── */
const STATUS_HEADS = {
  pending:   { heading: 'Your complaint has been received', line: 'Thank you for reaching out to us. Your complaint is now being processed and will be reviewed shortly.' },
  in_review: { heading: 'Your case is being reviewed',       line: 'Our team is currently looking into your case. We will let you know as soon as there is an update.' },
  resolved:  { heading: 'Your case has been resolved',       line: 'We are glad to inform you that your case has been resolved. Thank you for your patience.' },
  fixed:     { heading: 'Your case has been fixed',          line: 'The issue you reported has been fixed. Please let us know if you need anything else.' },
  rejected:  { heading: 'Your case was reviewed',            line: 'After careful review we were unable to proceed with this case. See the official reply below for details.' },
};

/* ── Public: send a complaint email (submit / status change) ── */
export async function sendComplaintEmail({ to, name, referenceId, title, status, feedback, actionLabel }) {
  const client = getClient();
  if (!client) {
    console.warn(`[email] Email skipped — RESEND_API_KEY not configured. (to=${to}, ref=${referenceId}, status=${status})`);
    return { skipped: true };
  }

  const isStatusChange = Boolean(actionLabel);
  const head = STATUS_HEADS[status] || {
    heading: isStatusChange ? `Your case ${referenceId} has been updated` : 'Your complaint has been received',
    line: isStatusChange ? 'Here is where things stand:' : 'Thank you for reaching out. We have received your complaint and it is now being processed.',
  };
  const heading = isStatusChange
    ? `Your case ${escapeHtml(referenceId)} has been updated`
    : head.heading;

  const { to: sendTo, deliverTo, subjectPrefix, redirectNote } = resolveRecipient(to);

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi <strong>${escapeHtml(name)}</strong>,</p>
    <p style="margin:0 0 20px 0;">${escapeHtml(head.line)}</p>
    <p style="margin:0 0 24px 0;font-family:${BRAND.fontDisplay};font-size:17px;color:${BRAND.green};font-weight:700;">${escapeHtml(title)}</p>
    <p style="margin:0 0 24px 0;">${statusPill(status)}</p>
    ${redirectNote}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fbfaf5;border:1px solid ${BRAND.border};border-radius:12px;border-left:4px solid ${BRAND.gold};margin:0 0 24px 0;">
      <tr><td style="padding:14px 18px 0 18px;color:${BRAND.muted};font-size:12px;letter-spacing:0.04em;text-transform:uppercase;">Reference ID</td></tr>
      <tr><td style="padding:4px 18px 14px 18px;">
        <span style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:16px;font-weight:700;color:${BRAND.green};letter-spacing:0.03em;">${escapeHtml(referenceId)}</span>
      </td></tr>
    </table>
    ${feedback && String(feedback).trim()
      ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fdf8e8;border-left:4px solid ${BRAND.gold};border-radius:0 10px 10px 0;margin:0 0 24px 0;">
           <tr><td style="padding:14px 18px;color:#6d5614;font-size:14px;line-height:1.6;">
             <strong style="display:block;margin-bottom:6px;color:${BRAND.green};">Official reply:</strong>
             ${escapeHtml(feedback)}
           </td></tr>
         </table>`
      : ''}
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 8px 0;">
      <tr>
        <td align="center" bgcolor="${BRAND.green}" style="border-radius:10px;">
          <a href="${escapeHtml(config.frontendUrl + '/track?id=' + encodeURIComponent(referenceId))}" style="display:inline-block;padding:13px 30px;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;font-family:${BRAND.fontBody};letter-spacing:0.02em;">Track your complaint</a>
        </td>
      </tr>
    </table>
    <p style="margin:20px 0 0 0;color:${BRAND.muted};font-size:13px;">You can also use this reference ID to track your case online at any time. Please keep it safe.</p>
  `;

  const plainText = `Hi ${name},

${heading}

${head.line}

Title: ${title}
Current status: ${status}
Reference ID: ${referenceId}
${feedback ? `\nOfficial reply:\n${feedback}\n` : ''}

Track your complaint: ${config.frontendUrl}/track?id=${referenceId}`;

  const { html, text } = brandedLayout({ preheader: `${heading} — ${referenceId}`, bodyHtml, plainText });

  try {
    const { error } = await client.emails.send({
      from: config.email.from,
      to: sendTo,
      subject: `${subjectPrefix}${heading}${isStatusChange ? '' : ` — ${referenceId}`}`,
      html,
      text,
    });
    if (error) throw error;
    return { sent: true, deliverTo };
  } catch (err) {
    console.error('[email] Failed to send complaint email:', err.message);
    return { sent: false, error: err.message };
  }
}

/* ── Public: send a password-reset email ───────────────── */
export async function sendResetEmail({ to, name, resetUrl }) {
  const client = getClient();
  if (!client) {
    console.warn(`[email] Reset email skipped — RESEND_API_KEY not configured. (to=${to})`);
    return { skipped: true };
  }

  const { to: sendTo, deliverTo, subjectPrefix, redirectNote } = resolveRecipient(to);

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi <strong>${escapeHtml(name)}</strong>,</p>
    <p style="margin:0 0 20px 0;">We received a request to reset your password for the <strong>LASUSTECH Student Resolution Center</strong>. Click the button below to set a new password.</p>
    ${redirectNote}
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 8px 0;">
      <tr>
        <td align="center" bgcolor="${BRAND.gold}" style="border-radius:10px;">
          <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:13px 30px;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;font-family:${BRAND.fontBody};">Reset your password</a>
        </td>
      </tr>
    </table>
    <p style="margin:20px 0 0 0;color:${BRAND.muted};font-size:13px;">This link expires in <strong>30 minutes</strong>. If you did not request this, you can safely ignore this email.</p>
  `;

  const plainText = `Hi ${name},

We received a request to reset your password for the LASUSTECH Student Resolution Center.

Open this link to set a new password (expires in 30 minutes):
${resetUrl}

If you did not request this, you can safely ignore this email.`;

  const { html, text } = brandedLayout({ preheader: 'Reset your password', bodyHtml, plainText });

  try {
    const { error } = await client.emails.send({
      from: config.email.from,
      to: sendTo,
      subject: `${subjectPrefix}Reset your LASUSTECH password`,
      html,
      text,
    });
    if (error) throw error;
    return { sent: true, deliverTo };
  } catch (err) {
    console.error('[email] Failed to send reset email:', err.message);
    return { sent: false, error: err.message };
  }
}