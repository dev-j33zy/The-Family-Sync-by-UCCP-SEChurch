// =============================================
// EMAIL TEMPLATES
//
// Every message returns `{ subject, text, html }`; lib/email.js turns that into
// a MIME body. Keep the HTML table-based and inline-styled — Gmail strips
// <style> blocks in some clients and every other client is worse.
// =============================================

const BRAND = '#6b0e1e'
const BRAND_DARK = '#4a0a15'
const PAGE_BG = '#f3efec'
const TEXT = '#2b2b2b'
const MUTED = '#6b6b6b'
const BORDER = '#e6e0da'

// Names and addresses are user-supplied; they must not be able to inject
// markup into a message that carries a sign-in link.
const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => HTML_ENTITIES[c])
}

// The church is in the Philippines and the app renders dates in the viewer's
// own timezone. Email has no viewer timezone, so pin it and say so.
function formatWhen(date = new Date()) {
  return (
    new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date) + ' PHT'
  )
}

function layout({ heading, intro, body, footnote }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${heading}</title>
  </head>
  <body style="margin:0;padding:0;background:${PAGE_BG};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE_BG};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <tr>
              <td style="background:${BRAND};padding:22px 28px;">
                <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.2px;">The Family Sync</div>
                <div style="color:#e8c9cf;font-size:12px;margin-top:2px;">UCCP Sukat &middot; Membership Committee</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${TEXT};">${heading}</h1>
                <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${TEXT};">${intro}</p>
                ${body}
                ${
                  footnote
                    ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:${MUTED};">${footnote}</p>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td style="background:#faf8f6;border-top:1px solid ${BORDER};padding:16px 28px;">
                <p style="margin:0;font-size:11px;line-height:1.6;color:${MUTED};">
                  This message was sent by The Family Sync for UCCP Sukat. It is an
                  automated account message, so replies may not be monitored.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function button(url, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
  <tr>
    <td style="border-radius:8px;background:${BRAND};">
      <a href="${url}" style="display:inline-block;padding:13px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
    </td>
  </tr>
</table>`
}

function linkFallback(url) {
  return `<p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">
  If the button does not work, copy this link into your browser:<br />
  <a href="${url}" style="color:${BRAND_DARK};word-break:break-all;">${url}</a>
</p>`
}

function greeting(name) {
  return name ? `Hello ${name},` : 'Hello,'
}

// ---------------------------------------------
// Invite / reset
// ---------------------------------------------

export function inviteEmail({ name, inviteUrl, expiresAt }) {
  const when = formatWhen(expiresAt)
  return {
    subject: 'You have been invited to The Family Sync',
    text: `${greeting(name)}

An administrator has created an account for you in The Family Sync, the membership system of UCCP Sukat.

Set your password here: ${inviteUrl}

This link expires on ${when} and can only be used once. Once you set a password, your email address is verified and you can sign in.

If you were not expecting this invitation, you can ignore this email.`,
    html: layout({
      heading: 'You have been invited',
      intro: `${greeting(esc(name))} An administrator has created an account for you in The Family Sync, the membership system of UCCP Sukat.`,
      body: `${button(inviteUrl, 'Set your password')}
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${TEXT};">
          This link expires on <strong>${when}</strong> and can only be used once.
          Setting a password also verifies this email address.
        </p>
        ${linkFallback(inviteUrl)}`,
      footnote: 'If you were not expecting this invitation, you can safely ignore this email — no account changes will happen until the link is used.',
    }),
  }
}

export function resetEmail({ name, resetUrl, expiresAt }) {
  const when = formatWhen(expiresAt)
  return {
    subject: 'Reset your Family Sync password',
    text: `${greeting(name)}

A password reset was requested for your Family Sync account.

Choose a new password here: ${resetUrl}

This link expires on ${when} and can only be used once. If you did not ask for this, you can ignore this email — your current password stays active.`,
    html: layout({
      heading: 'Reset your password',
      intro: `${greeting(esc(name))} A password reset was requested for your Family Sync account.`,
      body: `${button(resetUrl, 'Choose a new password')}
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${TEXT};">
          This link expires on <strong>${when}</strong> and can only be used once.
        </p>
        ${linkFallback(resetUrl)}`,
      footnote: 'If you did not request this, you can ignore this email — your current password stays active.',
    }),
  }
}

// ---------------------------------------------
// Account notifications
// ---------------------------------------------

export function passwordChangedEmail({ name, when = new Date() }) {
  const at = formatWhen(when)
  return {
    subject: 'Your Family Sync password was changed',
    text: `Hello${name ? ` ${name}` : ''},

The password for your Family Sync account was changed on ${at}.

If you made this change, no action is needed. If you did not, ask an administrator to reset your password immediately.

Other devices signed in to your account have been signed out.`,
    html: layout({
      heading: 'Your password was changed',
      intro: `${greeting(esc(name))} The password for your Family Sync account was changed on <strong>${at}</strong>.`,
      body: `<p style="margin:0;font-size:14px;line-height:1.6;color:${TEXT};">
          If you made this change, no action is needed. Any other devices that
          were signed in to your account have been signed out.
        </p>`,
      footnote: 'If you did not change your password, ask an administrator to reset it immediately.',
    }),
  }
}

export function nameChangedEmail({ name, previousName, when = new Date() }) {
  const at = formatWhen(when)
  return {
    subject: 'Your Family Sync account name was updated',
    text: `Hello${name ? ` ${name}` : ''},

The name on your Family Sync account was updated on ${at}.
${previousName ? `\nPrevious name: ${previousName}\n` : ''}
If you made this change, no action is needed. If you did not, contact an administrator.`,
    html: layout({
      heading: 'Your account name was updated',
      intro: `${greeting(esc(name))} The name on your Family Sync account was updated on <strong>${at}</strong>.`,
      body: `${
        previousName
          ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;font-size:14px;">
              <tr><td style="padding:4px 0;color:${MUTED};">Previous name</td><td style="padding:4px 0;color:${TEXT};">${esc(previousName)}</td></tr>
              <tr><td style="padding:4px 0;color:${MUTED};">New name</td><td style="padding:4px 0;color:${TEXT};">${esc(name)}</td></tr>
            </table>`
          : ''
      }
      <p style="margin:0;font-size:14px;line-height:1.6;color:${TEXT};">
        If you made this change, no action is needed. If you did not, contact an administrator.
      </p>`,
    }),
  }
}

export function emailChangedEmail({ name, oldEmail, newEmail, audience, when = new Date() }) {
  const at = formatWhen(when)
  const isNew = audience === 'new'
  return {
    subject: isNew
      ? 'Your Family Sync sign-in email was updated'
      : 'Your Family Sync sign-in email was changed',
    text: isNew
      ? `${greeting(name)}

The sign-in email for your Family Sync account was changed to this address (${newEmail}) on ${at}.

Use this address the next time you sign in.`
      : `${greeting(name)}

The sign-in email for your Family Sync account was changed on ${at}.
Previous address: ${oldEmail}
New address: ${newEmail}

If you did not make this change, contact an administrator immediately.`,
    html: layout({
      heading: isNew ? 'Your sign-in email was updated' : 'Your sign-in email was changed',
      intro: isNew
        ? `${greeting(esc(name))} The sign-in email for your Family Sync account was changed to <strong>${esc(newEmail)}</strong> on ${at}.`
        : `${greeting(esc(name))} The sign-in email for your Family Sync account was changed on <strong>${at}</strong>.`,
      body: `${
        isNew
          ? `<p style="margin:0;font-size:14px;line-height:1.6;color:${TEXT};">
              Use this address the next time you sign in. Your password has not changed.
            </p>`
          : `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;font-size:14px;">
              <tr><td style="padding:4px 0;color:${MUTED};">Previous address</td><td style="padding:4px 0;color:${TEXT};">${esc(oldEmail)}</td></tr>
              <tr><td style="padding:4px 0;color:${MUTED};">New address</td><td style="padding:4px 0;color:${TEXT};">${esc(newEmail)}</td></tr>
            </table>
            <p style="margin:0;font-size:14px;line-height:1.6;color:${TEXT};">
              If you did not make this change, contact an administrator immediately.
            </p>`
      }`,
    }),
  }
}

export function testEmail({ name, when = new Date() }) {
  const at = formatWhen(when)
  return {
    subject: 'Family Sync email test',
    text: `Email is working.

This test message was sent from The Family Sync on ${at}.
Signed in as: ${name || 'an administrator'}.`,
    html: layout({
      heading: 'Email is working',
      intro: `This test message was sent from The Family Sync on <strong>${at}</strong>.`,
      body: `<p style="margin:0;font-size:14px;line-height:1.6;color:${TEXT};">
        Invitations, password resets and account notifications will now be delivered
        through the Gmail API.
      </p>`,
      footnote: `Requested by ${esc(name || 'an administrator')}.`,
    }),
  }
}
