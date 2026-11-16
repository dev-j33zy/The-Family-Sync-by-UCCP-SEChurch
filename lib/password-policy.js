// Shared password rule, imported by both server routes and client forms.
export const MIN_PASSWORD_LENGTH = 8

/** Returns a human-readable problem, or null when the password is acceptable. */
export function passwordProblem(password) {
  const value = String(password ?? '')
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  }
  return null
}
