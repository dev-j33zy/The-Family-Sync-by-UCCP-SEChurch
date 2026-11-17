// The authorization script was renamed: the refresh token now covers the
// Google Sheets export as well as Gmail, so it lives in scripts/google-auth.js.
//
// This file only exists so `node scripts/gmail-auth.js` keeps working.
console.log('\nscripts/gmail-auth.js is now scripts/google-auth.js (it also authorizes the Sheets export).\n')
await import('./google-auth.js')
