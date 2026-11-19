'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useTheme } from '@/components/ThemeProvider'
import { useUser } from '@/components/UserProvider'
import { parseDateValue, toDateOnlyString, getStatusLabel } from '@/lib/utils'
import { passwordProblem } from '@/lib/password-policy'
import { memberDuplicateKey } from '@/lib/member-duplicate'
import { memberExportMatrix, memberExportTitle } from '@/lib/member-export'
import { SaveIcon, SunIcon, MoonIcon, UploadIcon, PdfFileIcon, GoogleSheetsIcon, ExcelFileIcon, CsvFileIcon, FileIcon, AlertCircleIcon, PlusIcon } from '@/components/Icons'
import PendingPhotoReview from '@/components/PendingPhotoReview'

const COLUMN_MAP = {
  'last name': 'last_name',
  'lastname': 'last_name',
  'surname': 'last_name',
  'family name': 'last_name',
  'first name': 'first_name',
  'firstname': 'first_name',
  'given name': 'first_name',
  'middle name': 'middle_name',
  'middlename': 'middle_name',
  'middle initial': 'middle_name',
  'prefix': 'prefix',
  'name prefix': 'prefix',
  'suffix': 'prefix',
  'name suffix': 'prefix',
  'date of birth': 'date_of_birth',
  'dob': 'date_of_birth',
  'birth date': 'date_of_birth',
  'birthday': 'date_of_birth',
  'birthdate': 'date_of_birth',
  'gender': 'gender',
  'sex': 'gender',
  'citizenship': 'citizenship',
  'nationality': 'citizenship',
  'relationship status': 'relationship_status',
  'marital status': 'relationship_status',
  'civil status': 'relationship_status',
  'wedding anniversary': 'wedding_anniversary',
  'anniversary': 'wedding_anniversary',
  'communicant class graduate': 'communicant_class_graduate',
  'communicant': 'communicant_class_graduate',
  'date of membership': 'date_of_membership',
  'membership date': 'date_of_membership',
  'member since': 'date_of_membership',
  'membership status': 'membership_status',
  'status': 'membership_status',
  'membership type': 'membership_type',
  'member type': 'membership_type',
  'type': 'membership_type',
  'phone number': 'phone_number',
  'phone': 'phone_number',
  'telephone': 'phone_number',
  'contact number': 'phone_number',
  'mobile': 'phone_number',
  'email address': 'email_address',
  'email': 'email_address',
  'e-mail': 'email_address',
  'street address': 'street_address',
  'village': 'village',
  'barangay': 'barangay',
  'brgy': 'barangay',
  'city': 'city',
  'municipality': 'city',
  'home address': 'street_address',
  'address': 'street_address',
}

const REQUIRED_FIELDS = ['last_name', 'first_name', 'date_of_birth', 'gender']

const ENUM_FIELDS = [
  ['gender', ['male', 'female', 'other']],
  ['relationship_status', ['single', 'married', 'widowed', 'separated', 'divorced']],
  ['membership_status', ['new', 'active', 'dormant', 'cancelled']],
  ['membership_type', ['regular', 'associate', 'affiliate']],
  ['communicant_class_graduate', ['yes', 'no']],
]

const DATE_FIELDS = ['date_of_birth', 'wedding_anniversary', 'date_of_membership']

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const EXCEL_EPOCH = new Date(1899, 11, 30)

// Spreadsheet date cells arrive as Date objects, Excel serial numbers, or text.
// Returns YYYY-MM-DD, or the original text when it cannot be understood (the
// row validator then reports it).
function resolveDateCell(value, field) {
  // Membership is recorded as a year only. A bare "2015" (text or number) is
  // the year 2015 — Excel would otherwise read the number 2015 as a serial
  // date and produce 1905-07-08.
  if (field === 'date_of_membership' && !(value instanceof Date)) {
    const text = String(value).trim()
    if (/^\d{4}$/.test(text)) {
      const year = Number(text)
      if (year >= 1900 && year <= new Date().getFullYear()) return `${text}-01-01`
    }
  }

  if (value instanceof Date) return toDateOnlyString(value)
  if (typeof value === 'number') {
    return toDateOnlyString(new Date(EXCEL_EPOCH.getTime() + value * 86400000))
  }
  const text = String(value).trim()
  if (!text) return ''
  const date = parseDateValue(text)
  return date ? toDateOnlyString(date) : text
}

// Mirrors the member schema before the file is sent: required fields, enum
// values, and real calendar dates. Enum values are normalised in place ("Male"
// becomes "male") so a masterlist exported elsewhere still imports. Returns the
// list of problems; an empty list means the row is importable.
function validateMemberRow(member) {
  const problems = []
  const missing = REQUIRED_FIELDS.filter(f => !member[f])
  if (missing.length) problems.push(`Missing: ${missing.join(', ')}`)

  for (const [field, allowed] of ENUM_FIELDS) {
    const value = member[field]
    if (!value) continue
    const normalized = String(value).trim().toLowerCase()
    if (!allowed.includes(normalized)) {
      problems.push(`Invalid ${field.replaceAll('_', ' ')} "${value}"`)
    } else if (field === 'communicant_class_graduate') {
      member[field] = normalized === 'yes' ? 'Yes' : 'No'
    } else {
      member[field] = normalized
    }
  }

  for (const field of DATE_FIELDS) {
    const value = member[field]
    if (value && !isValidDateOnly(value)) {
      problems.push(`Invalid ${field.replaceAll('_', ' ')} "${value}"`)
    }
  }

  if (member.date_of_birth && isValidDateOnly(member.date_of_birth)) {
    if (member.date_of_birth > toDateOnlyString(new Date())) {
      problems.push('Date of birth is in the future')
    }
  }

  return problems
}

function normalizeHeader(header) {
  if (!header) return null
  return header.toString().trim().toLowerCase()
}

function mapHeaders(headers) {
  const mapping = {}
  for (const header of headers) {
    const normalized = normalizeHeader(header)
    if (!normalized) continue
    mapping[header] = COLUMN_MAP[normalized] || null
  }
  return mapping
}

export default function SettingsPage() {
  const router = useRouter()
  const { theme, devToolsVisible, toggleTheme, toggleDevTools, mounted } = useTheme()
  const { user, loading: userLoading, setUser } = useUser()
  const fileInputRef = useRef(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const [importProgress, setImportProgress] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importErrors, setImportErrors] = useState(null)
  const [applying, setApplying] = useState(false)

  // 'pdf' | 'sheets' | null — one export at a time, each with its own button.
  const [exporting, setExporting] = useState(null)
  const [exportProgress, setExportProgress] = useState(null)

  // The root UserProvider already fetched /api/auth/me once — reuse it instead
  // of making a second round-trip on every visit to Settings.
  useEffect(() => {
    let cancelled = false
    async function syncUser() {
      if (userLoading) return
      if (!user) { router.push('/login'); return }
      // Defer to a microtask so this doesn't synchronously cascade into another
      // render while the provider is still settling its own state.
      await Promise.resolve()
      if (cancelled) return
      setFirstName(user.first_name || '')
      setLastName(user.last_name || '')
      setEmail(user.email || '')
    }
    syncUser()
    return () => { cancelled = true }
  }, [user, userLoading, router])

  // Only administrators can open /admin/create-user; keep the shortcut in
  // step with that page instead of offering it to everyone.
  const canManageUsers = user?.role === 'Administrator' || user?.role === 'admin'

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      if (password) {
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          setSaving(false)
          return
        }
        const problem = passwordProblem(password)
        if (problem) {
          setError(problem)
          setSaving(false)
          return
        }
        if (!currentPassword) {
          setError('Current password is required to change the password')
          setSaving(false)
          return
        }
      }

      if (email.trim().toLowerCase() !== (user.email || '').toLowerCase() && !currentPassword) {
        setError('Current password is required to change the sign-in email')
        setSaving(false)
        return
      }

      const displayName = [firstName, lastName].filter(Boolean).join(' ').trim()
      const updates = {
        display_name: displayName || null,
        first_name: firstName || null,
        last_name: lastName || null,
      }

      if (email !== user.email) {
        updates.email = email
      }

      if (currentPassword) {
        updates.current_password = currentPassword
      }

      if (password) {
        updates.password = password
      }

      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save settings')

      if (data.user) {
        setUser(data.user)
        setFirstName(data.user.first_name || '')
        setLastName(data.user.last_name || '')
        setEmail(data.user.email || '')
      }

      setMessage('Settings saved. A confirmation email is on its way for any account change.')
      setCurrentPassword('')
      setPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportProgress({ message: 'Reading file...', percent: 10 })
    setImportPreview(null)
    setImportErrors(null)

    const reader = new FileReader()
    reader.onload = async function (evt) {
      setImportProgress({ message: 'Parsing file...', percent: 40 })
      try {
        // XLSX is ~500 KB — only load it when a file is actually selected.
        const XLSX = await import('xlsx')
        const data = new Uint8Array(evt.target.result)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        setImportProgress({ message: 'Processing data...', percent: 70 })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const rawData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' })

        if (!rawData.length) {
          setImportErrors('The file appears to be empty.')
          setImportProgress(null)
          return
        }

        const headers = Object.keys(rawData[0])
        const mapping = mapHeaders(headers)

        const unmapped = headers.filter(h => !mapping[h])
        const mapped = headers.filter(h => mapping[h])

        const parsed = rawData.map((row, idx) => {
          const member = { _row: idx + 2 }
          let hasData = false
          for (const header of mapped) {
            const field = mapping[header]
            const val = row[header]
            if (val !== undefined && val !== null && val !== '') {
              if (DATE_FIELDS.includes(field)) {
                const resolved = resolveDateCell(val, field)
                if (resolved) member[field] = resolved
              } else {
                member[field] = String(val).trim()
              }
              hasData = true
            }
          }
          if (!hasData) return null
          return member
        }).filter(Boolean)

        // Flag duplicates against the records on file and against earlier rows
        // in the same file, then apply the schema-level field checks.
        setImportProgress({ message: 'Checking for duplicates...', percent: 85 })
        let existingKeys = new Set()
        try {
          const res = await fetch('/api/members', { cache: 'no-store' })
          if (res.ok) {
            const existing = await res.json()
            if (Array.isArray(existing)) {
              existingKeys = new Set(existing.map(memberDuplicateKey).filter(Boolean))
            }
          }
        } catch {
          // Without the lookup the preview cannot flag duplicates, but the
          // import endpoint still rejects them.
        }

        const seenRows = new Map()
        for (const member of parsed) {
          const problems = validateMemberRow(member)
          const key = memberDuplicateKey(member)
          if (key) {
            if (existingKeys.has(key)) {
              problems.push('Already exists in the records')
              member._duplicate = true
            } else if (seenRows.has(key)) {
              problems.push(`Duplicate of row ${seenRows.get(key)} in this file`)
              member._duplicate = true
            } else {
              seenRows.set(key, member._row)
            }
          }
          member._valid = problems.length === 0
          member._errors = problems.length ? problems.join('; ') : null
        }

        setImportProgress({ message: 'Preparing preview...', percent: 100 })
        setTimeout(() => {
          setImportProgress(null)
          setImportPreview({ members: parsed, mapping, unmapped })
        }, 300)
      } catch (err) {
        setImportErrors('Failed to parse file: ' + err.message)
        setImportProgress(null)
      }
    }
    reader.onerror = function () {
      setImportErrors('Failed to read file.')
      setImportProgress(null)
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleApplyImport() {
    if (!importPreview) return
    setApplying(true)
    setImportProgress({ message: 'Importing members...', percent: 20 })

    try {
      const validMembers = importPreview.members.filter(m => m._valid).map(m => {
        const { _valid, _errors, _duplicate, ...member } = m
        return member
      })

      if (!validMembers.length) {
        setImportErrors('No valid members to import.')
        setApplying(false)
        setImportProgress(null)
        return
      }

      const chunkSize = 50
      let imported = 0
      const allResults = []

      for (let i = 0; i < validMembers.length; i += chunkSize) {
        const chunk = validMembers.slice(i, i + chunkSize)
        const percent = 20 + Math.round(((i + chunk.length) / validMembers.length) * 70)
        setImportProgress({ message: `Importing ${Math.min(i + chunkSize, validMembers.length)} of ${validMembers.length}...`, percent })

        const res = await fetch('/api/members/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ members: chunk }),
        })

        const result = await res.json()
        if (!res.ok) {
          if (Array.isArray(result.conflicts) && result.conflicts.length) {
            const details = result.conflicts.map(c =>
              c.reason === 'existing'
                ? `Row ${c.row}: ${c.first_name} ${c.last_name} is already in the records`
                : `Row ${c.row}: duplicates row ${c.duplicate_of} in this file`
            ).join('; ')
            throw new Error(`${result.error} (${details})`)
          }
          throw new Error(result.error)
        }
        imported += result.count
        allResults.push(...result.data)
      }

      setImportProgress({ message: 'Done!', percent: 100 })
      setTimeout(() => {
        setImportProgress(null)
        setImportPreview(null)
        setMessage(`Successfully imported ${imported} member${imported !== 1 ? 's' : ''}.`)
      }, 500)
    } catch (err) {
      setImportErrors(err.message)
      setImportProgress(null)
    }
    setApplying(false)
  }

  async function handleExportPdf() {
    setExporting('pdf')
    setError(null)
    setExportProgress({ message: 'Fetching members\u2026', percent: 15 })

    try {
      const res = await fetch('/api/members')
      const members = await res.json()
      if (!res.ok) throw new Error(members.error || 'Failed to fetch members')
      if (!members.length) throw new Error('There are no members to export yet.')

      setExportProgress({ message: 'Building the PDF\u2026', percent: 55 })

      // jsPDF and its table plugin are a few hundred kilobytes, so they are
      // only downloaded when someone actually asks for a PDF.
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])

      const title = memberExportTitle()
      const [header, ...rows] = memberExportMatrix(members, { display: true })
      const generated = new Date().toLocaleString('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
      })

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(38, 30, 32)
      doc.text('SEC Membership Masterlist', 8, 13)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(120, 110, 112)
      doc.text(
        `${members.length} member${members.length === 1 ? '' : 's'}  ·  UCCP SE Church  ·  generated ${generated}`,
        8,
        18
      )

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      autoTable(doc, {
        head: [header],
        body: rows,
        startY: 22,
        margin: { top: 22, left: 6, right: 6, bottom: 13 },
        styles: {
          font: 'helvetica',
          fontSize: 6.2,
          cellPadding: 1.1,
          overflow: 'linebreak',
          textColor: [45, 38, 40],
          lineColor: [225, 218, 220],
          lineWidth: 0.1,
          valign: 'top',
        },
        headStyles: {
          fillColor: [107, 14, 30],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'left',
        },
        alternateRowStyles: { fillColor: [250, 246, 247] },
        didDrawPage: () => {
          doc.setFontSize(7)
          doc.setTextColor(140, 130, 132)
          doc.text('The Family Sync · UCCP SE Church', 6, pageHeight - 5)
          doc.text(
            `Page ${doc.internal.getCurrentPageInfo().pageNumber} of @@TOTAL@@`,
            pageWidth - 6,
            pageHeight - 5,
            { align: 'right' }
          )
        },
      })

      // DidDrawPage runs while the table is still paginating, so the total is
      // filled in afterwards (a plain literal, not a regex, as the placeholder).
      doc.putTotalPages('@@TOTAL@@')

      setExportProgress({ message: 'Saving\u2026', percent: 95 })
      doc.save(`${title}.pdf`)

      setExportProgress({ message: 'Done!', percent: 100 })
      setTimeout(() => {
        setExportProgress(null)
        setMessage(`Exported ${members.length} member${members.length !== 1 ? 's' : ''} as a PDF.`)
      }, 500)
    } catch (err) {
      setError(err.message)
      setExportProgress(null)
    }
    setExporting(null)
  }

  // Excel and CSV share the spreadsheet rows: same headers, same stored
  // values, so either file can be re-imported through the importer above.
  async function handleExportWorkbook(format) {
    setExporting(format)
    setError(null)
    setExportProgress({ message: 'Fetching members\u2026', percent: 20 })

    try {
      // Load the workbook library and the member data in parallel, and only
      // when an export is actually requested.
      const [XLSX, res] = await Promise.all([import('xlsx'), fetch('/api/members')])
      const members = await res.json()
      if (!res.ok) throw new Error(members.error || 'Failed to fetch members')
      if (!members.length) throw new Error('There are no members to export yet.')

      setExportProgress({ message: 'Building the file\u2026', percent: 65 })

      const matrix = memberExportMatrix(members)
      const ws = XLSX.utils.aoa_to_sheet(matrix)

      // Readable column widths when the file is opened in Excel; ignored by CSV.
      ws['!cols'] = matrix[0].map((label, column) => {
        const longest = matrix.slice(1, 200).reduce(
          (width, row) => Math.max(width, String(row[column] ?? '').length),
          label.length
        )
        return { wch: Math.min(40, longest + 2) }
      })

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Members')

      setExportProgress({ message: 'Saving\u2026', percent: 90 })
      const title = memberExportTitle()
      XLSX.writeFile(wb, `${title}.${format}`, { bookType: format })

      setExportProgress({ message: 'Done!', percent: 100 })
      setTimeout(() => {
        setExportProgress(null)
        setMessage(
          `Exported ${members.length} member${members.length !== 1 ? 's' : ''} as ${format === 'csv' ? 'CSV' : 'an Excel workbook'}.`
        )
      }, 500)
    } catch (err) {
      setError(err.message)
      setExportProgress(null)
    }
    setExporting(null)
  }

  async function handleExportSheets() {
    // Opened during the click (before any await) so the popup blocker lets it
    // through; it is pointed at the new sheet once Google answers.
    let tab = window.open('', '_blank')
    if (tab) {
      try {
        tab.opener = null
      } catch {
        // Cross-origin assignment can be refused; the tab still navigates.
      }
    }

    setExporting('sheets')
    setError(null)
    setExportProgress({ message: 'Creating the spreadsheet\u2026', percent: 40 })

    try {
      const res = await fetch('/api/export/sheets', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to export to Google Sheets')

      setExportProgress({ message: 'Done!', percent: 100 })

      if (tab) {
        tab.location.replace(data.url)
      } else {
        window.location.href = data.url
      }

      const accessNote =
        data.access === 'public'
          ? ' Anyone with the link can view it.'
          : data.access === 'domain'
            ? ` Viewable by anyone signed in to ${data.domain}.`
            : data.sharedWith
              ? ` Shared with ${data.sharedWith}.`
              : ' It is owned by the church Google account, so open it there if the link asks for access.'
      setMessage(`Created \u201c${data.title}\u201d with ${data.rows} member${data.rows !== 1 ? 's' : ''}.${accessNote}`)
      setTimeout(() => setExportProgress(null), 1200)
    } catch (err) {
      if (tab) tab.close()
      setError(err.message)
      setExportProgress(null)
    }
    setExporting(null)
  }

  function closePreview() {
    setImportPreview(null)
    setImportErrors(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-wrapper">
          <div className="page-header flex items-center justify-between">
            <div>
              <h1 className="page-title" style={{ margin: 0 }}>Settings</h1>
              <p className="page-subtitle">Manage your account and preferences</p>
            </div>
            <button
              type="submit"
              form="settings-form"
              className="btn btn-primary page-action-btn"
              disabled={saving}
            >
              <SaveIcon size={18} />
              {saving ? 'Saving\u2026' : 'Save Settings'}
            </button>
          </div>

          {message && (
            <div className="settings-alert success">
              {message}
            </div>
          )}

          {error && (
            <div className="settings-alert error">
              {error}
            </div>
          )}

          {/* Data Management Section */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-header">
              <h2 className="card-title" style={{ margin: 0 }}>Data Management</h2>
            </div>
            <div className="card-body">
              <div className="import-export-grid">
                <div className="import-section">
                  <div className="import-export-icon">
                    <UploadIcon size={24} />
                  </div>
                  <h3 className="import-export-title">Import Members</h3>
                  <p className="import-export-desc">
                    Upload .xls, .xlsx, or .csv files to import members. Column headers matching the members table will be automatically populated.
                  </p>
                  <div className="import-controls">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xls,.xlsx,.csv"
                      onChange={handleFileSelect}
                      className="file-input"
                      id="import-file-input"
                    />
                    <button
                      className="btn btn-primary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileIcon size={16} />
                      Choose File
                    </button>
                  </div>
                  {importProgress && (
                    <div className="progress-container">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${importProgress.percent}%` }} />
                      </div>
                      <span className="progress-text">{importProgress.message}</span>
                    </div>
                  )}
                  {importErrors && (
                    <div className="settings-alert error" style={{ marginTop: '12px', marginBottom: 0 }}>
                      <AlertCircleIcon size={16} />
                      {importErrors}
                    </div>
                  )}
                </div>

                <div className="export-section">
                  <div className="import-export-icon">
                    <GoogleSheetsIcon size={24} />
                  </div>
                  <h3 className="import-export-title">Export Members</h3>
                  <p className="import-export-desc">
                    Download a print-ready PDF, an Excel or CSV file, or create a Google Sheet in
                    the church account&apos;s Drive and open it.
                  </p>
                  <div className="export-controls">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={handleExportPdf}
                      disabled={!!exporting}
                    >
                      <PdfFileIcon size={16} />
                      {exporting === 'pdf' ? 'Exporting\u2026' : 'Export PDF'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={handleExportSheets}
                      disabled={!!exporting}
                    >
                      <GoogleSheetsIcon size={16} />
                      {exporting === 'sheets' ? 'Exporting\u2026' : 'Export to Google Sheets'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => handleExportWorkbook('xlsx')}
                      disabled={!!exporting}
                    >
                      <ExcelFileIcon size={16} />
                      {exporting === 'xlsx' ? 'Exporting\u2026' : 'Export Excel'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => handleExportWorkbook('csv')}
                      disabled={!!exporting}
                    >
                      <CsvFileIcon size={16} />
                      {exporting === 'csv' ? 'Exporting\u2026' : 'Export CSV'}
                    </button>
                  </div>
                  {exportProgress && (
                    <div className="progress-container">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${exportProgress.percent}%` }} />
                      </div>
                      <span className="progress-text">{exportProgress.message}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <form id="settings-form" onSubmit={handleSave}>
            <div className="settings-grid">
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title" style={{ margin: 0 }}>Profile</h2>
                </div>
                <div className="card-body">
                  <div className="form-group">
                    <label className="form-label">First Name</label>
                    <input
                      className="form-input"
                      placeholder="Your first name"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name</label>
                    <input
                      className="form-input"
                      placeholder="Your last name"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="admin@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                    <span className="form-hint">
                      Changing the sign-in email requires your current password. Both the old
                      and new address get a confirmation email.
                    </span>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h2 className="card-title" style={{ margin: 0 }}>Password</h2>
                </div>
                <div className="card-body">
                  <div className="form-group">
                    <label className="form-label">Current Password</label>
                    <input
                      className="form-input"
                      type="password"
                      placeholder="Your current password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <span className="form-hint">
                      Required to change your sign-in email or password.
                    </span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input
                      className="form-input"
                      type="password"
                      placeholder="Leave blank to keep current"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirm Password</label>
                    <input
                      className="form-input"
                      type="password"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: '24px' }}>
              <div className="card-header">
                <h2 className="card-title" style={{ margin: 0 }}>Appearance</h2>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Theme</label>
                  <div className="theme-toggle-group">
                    <button
                      type="button"
                      className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => { if (mounted) toggleTheme() }}
                    >
                      <MoonIcon size={18} />
                      Dark
                    </button>
                    <button
                      type="button"
                      className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => { if (mounted) toggleTheme() }}
                    >
                      <SunIcon size={18} />
                      Light
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-grid" style={{ marginTop: '24px' }}>
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title" style={{ margin: 0 }}>Developer</h2>
                </div>
                <div className="card-body">
                  <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <label className="form-label" style={{ margin: 0 }}>Next.js Dev Tools</label>
                        <span className="form-hint" style={{ display: 'block', marginTop: '2px' }}>Show the floating route indicator in development</span>
                      </div>
                      <button
                        type="button"
                        className={`btn ${devToolsVisible ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={toggleDevTools}
                        style={{ minWidth: '80px' }}
                      >
                        {devToolsVisible ? 'Visible' : 'Hidden'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {canManageUsers && <PendingPhotoReview />}

              {canManageUsers && (
                <div className="card">
                  <div className="card-header">
                    <h2 className="card-title" style={{ margin: 0 }}>New User</h2>
                  </div>
                  <div className="card-body">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => router.push('/admin/create-user')}
                    >
                      <PlusIcon size={16} />
                      Add New User
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
      </main>

      {/* Import Preview Modal */}
      {importPreview && (
        <div className="modal-overlay" onClick={closePreview}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: '960px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Review Imported Members</h2>
              <button className="modal-close" onClick={closePreview}>&times;</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflow: 'auto' }}>
              {importPreview.unmapped.length > 0 && (
                <div className="import-unmapped-notice">
                  <AlertCircleIcon size={16} />
                  <span>Unrecognized columns: {importPreview.unmapped.join(', ')}</span>
                </div>
              )}
              <div className="import-preview-stats">
                <span className="import-stat">
                  Total rows: <strong>{importPreview.members.length}</strong>
                </span>
                <span className="import-stat">
                  Valid: <strong className="import-stat-valid">{importPreview.members.filter(m => m._valid).length}</strong>
                </span>
                <span className="import-stat">
                  Duplicates: <strong className="import-stat-error">{importPreview.members.filter(m => m._duplicate).length}</strong>
                </span>
                <span className="import-stat">
                  With errors: <strong className="import-stat-error">{importPreview.members.filter(m => !m._valid).length}</strong>
                </span>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Last Name</th>
                      <th>First Name</th>
                      <th>Middle Name</th>
                      <th>Prefix</th>
                      <th>Date of Birth</th>
                      <th>Gender</th>
                      <th>Citizenship</th>
                      <th>Status</th>
                      <th>Type</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.members.map((m, i) => (
                      <tr key={i} className={!m._valid ? 'import-row-error' : ''}>
                        <td>{i + 1}</td>
                        <td className={!m.last_name ? 'import-cell-missing' : ''}>{m.last_name || '\u2014'}</td>
                        <td className={!m.first_name ? 'import-cell-missing' : ''}>{m.first_name || '\u2014'}</td>
                        <td>{m.middle_name || '\u2014'}</td>
                        <td>{m.prefix || '\u2014'}</td>
                        <td className={!m.date_of_birth ? 'import-cell-missing' : ''}>{m.date_of_birth || '\u2014'}</td>
                        <td>{m.gender || '\u2014'}</td>
                        <td>{m.citizenship || '\u2014'}</td>
                        <td>{getStatusLabel(m.membership_status)}</td>
                        <td>{m.membership_type || '\u2014'}</td>
                        <td>{m.phone_number || '\u2014'}</td>
                        <td>{m.email_address || '\u2014'}</td>
                        <td>{m._errors || '\u2014'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closePreview}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleApplyImport}
                disabled={applying || importPreview.members.filter(m => m._valid).length === 0}
              >
                <UploadIcon size={16} />
                {applying ? 'Applying\u2026' : `Apply ${importPreview.members.filter(m => m._valid).length} Member${importPreview.members.filter(m => m._valid).length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}