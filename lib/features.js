// Feature flags.
//
// SMS / text blasts are temporarily hidden while the messaging provider is
// being set up. Flip SMS_ENABLED to true to restore the sidebar entry, the
// /sms page, the /text-blasts redirect, and the /api/text-blasts routes.
// The code and data are kept intact so nothing needs to be re-created.
export const SMS_ENABLED = false
