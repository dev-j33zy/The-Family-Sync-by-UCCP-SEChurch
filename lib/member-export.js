import { getStatusLabel, membershipDateToYear } from './utils.js'

// =============================================
// MEMBER MASTERLIST EXPORT
//
// One definition of the masterlist columns, shared by the PDF download in the
// browser and the Google Sheets export on the server, so the two can never
// drift apart. The header text also matches the importer's COLUMN_MAP, which
// keeps an exported sheet re-importable.
// =============================================

/**
 * `display` is only used for human-facing output (the PDF). Spreadsheet output
 * keeps the stored values: the importer expects `new`, not "Preparatory".
 */
export const MEMBER_EXPORT_COLUMNS = [
  { label: 'Last Name', value: m => m.last_name },
  { label: 'First Name', value: m => m.first_name },
  { label: 'Middle Name', value: m => m.middle_name },
  { label: 'Prefix', value: m => m.prefix },
  { label: 'Date of Birth', value: m => m.date_of_birth },
  { label: 'Gender', value: m => m.gender },
  { label: 'Citizenship', value: m => m.citizenship },
  { label: 'Relationship Status', value: m => m.relationship_status },
  { label: 'Wedding Anniversary', value: m => m.wedding_anniversary },
  { label: 'Communicant Class Graduate', value: m => m.communicant_class_graduate },
  // Membership is recorded as a year only, even when a full date is stored.
  { label: 'Date of Membership', value: m => membershipDateToYear(m.date_of_membership) },
  {
    label: 'Membership Status',
    value: m => m.membership_status,
    display: m => (m.membership_status ? getStatusLabel(m.membership_status) : ''),
  },
  { label: 'Membership Type', value: m => m.membership_type },
  { label: 'Phone Number', value: m => m.phone_number },
  { label: 'Email Address', value: m => m.email_address },
  { label: 'Street Address', value: m => m.street_address },
  { label: 'Village', value: m => m.village },
  { label: 'Barangay', value: m => m.barangay },
  { label: 'City', value: m => m.city },
]

function cellText(value) {
  return value === null || value === undefined ? '' : String(value)
}

/**
 * Rows for a 2D export: the header row followed by one row per member.
 * Empty values become empty strings so both PDF and Sheets render a blank cell
 * rather than "undefined".
 *
 * @param {Array<object>} members
 * @param {{ display?: boolean }} options  display: human labels (PDF)
 * @returns {string[][]}
 */
export function memberExportMatrix(members, { display = false } = {}) {
  const header = MEMBER_EXPORT_COLUMNS.map(column => column.label)

  const rows = members.map(member =>
    MEMBER_EXPORT_COLUMNS.map(column => {
      if (display && column.display) return cellText(column.display(member))
      return cellText(column.value(member))
    })
  )

  return [header, ...rows]
}

/** Title used for the PDF filename, the sheet title, and its heading. */
export function memberExportTitle(date = new Date()) {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `SEC Membership Masterlist (${mm}-${dd}-${date.getFullYear()})`
}
