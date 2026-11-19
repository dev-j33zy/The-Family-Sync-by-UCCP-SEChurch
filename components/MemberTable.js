'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { calculateAge, capitalize, membershipDateToYear, getStatusLabel } from '@/lib/utils'
import { SearchIcon, UsersIcon, EyeIcon, EditIcon, TrashIcon, FilterIcon } from '@/components/Icons'

function SortIcon({ field, currentField, direction }) {
  if (currentField !== field) return <span style={{ opacity: 0.3 }}>↕</span>
  return <span style={{ color: 'var(--primary)' }}>{direction === 'asc' ? '↑' : '↓'}</span>
}

function getAvatarClass(gender) {
  if (gender === 'male') return 'table-avatar table-avatar-male'
  if (gender === 'female') return 'table-avatar table-avatar-female'
  return 'table-avatar table-avatar-other'
}

function getInitials(m) {
  return `${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}`.toUpperCase()
}

export default function MemberTable({ members, onDelete }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterGender, setFilterGender] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortField, setSortField] = useState('last_name')
  const [sortDir, setSortDir] = useState('asc')

  function handleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function clearFilters() {
    setSearch('')
    setFilterStatus('')
    setFilterType('')
    setFilterGender('')
  }

  const filtered = useMemo(() => {
    let list = [...members]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(m =>
        m.first_name?.toLowerCase().includes(q) ||
        m.last_name?.toLowerCase().includes(q) ||
        m.middle_name?.toLowerCase().includes(q) ||
        m.prefix?.toLowerCase().includes(q) ||
        m.member_code?.toLowerCase().includes(q) ||
        String(calculateAge(m.date_of_birth) ?? '').includes(q) ||
        m.citizenship?.toLowerCase().includes(q) ||
        m.street_address?.toLowerCase().includes(q) ||
        m.village?.toLowerCase().includes(q) ||
        m.barangay?.toLowerCase().includes(q) ||
        m.city?.toLowerCase().includes(q)
      )
    }
    if (filterStatus) list = list.filter(m => m.membership_status === filterStatus)
    if (filterType) list = list.filter(m => m.membership_type === filterType)
    if (filterGender) list = list.filter(m => m.gender === filterGender)

    list.sort((a, b) => {
      let aVal = a[sortField] || ''
      let bVal = b[sortField] || ''
      if (sortField === 'date_of_birth' || sortField === 'date_of_membership') {
        aVal = aVal ? new Date(aVal).getTime() : 0
        bVal = bVal ? new Date(bVal).getTime() : 0
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      aVal = String(aVal).toLowerCase()
      bVal = String(bVal).toLowerCase()
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    })
    return list
  }, [members, search, filterStatus, filterType, filterGender, sortField, sortDir])

  return (
    <div className="member-list-view">
      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-wrapper">
          <span className="search-icon"><SearchIcon size={16} /></span>
          <input
            id="member-search"
            className="form-input search-input"
            placeholder="Search by name, ID, age, citizenship, or address…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon filter-toggle"
          aria-label={filtersOpen ? 'Hide filters' : 'Show filters'}
          aria-expanded={filtersOpen}
          aria-controls="member-filters"
          onClick={() => setFiltersOpen(open => !open)}
        >
          <FilterIcon size={18} />
        </button>
        <div id="member-filters" className={`member-filters${filtersOpen ? ' open' : ''}`}>
          <select id="filter-status" className="form-select filter-select filter-dropdown" value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Membership Status</option>
            <option value="new">Preparatory</option>
            <option value="active">Active</option>
            <option value="dormant">Dormant</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select id="filter-type" className="form-select filter-select filter-dropdown" value={filterType}
            onChange={e => setFilterType(e.target.value)}>
            <option value="">Membership Type</option>
            <option value="regular">Regular</option>
            <option value="associate">Associate</option>
            <option value="affiliate">Affiliate</option>
          </select>
          <select id="filter-gender" className="form-select filter-select filter-dropdown" value={filterGender}
            onChange={e => setFilterGender(e.target.value)}>
            <option value="">All Genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          {(search || filterStatus || filterType || filterGender) && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear</button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
        {filtered.length} member{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container member-table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th onClick={() => handleSort('last_name')}>Name <SortIcon field="last_name" currentField={sortField} direction={sortDir} /></th>
                <th className="mobile-hide" onClick={() => handleSort('date_of_birth')}>Age <SortIcon field="date_of_birth" currentField={sortField} direction={sortDir} /></th>
                <th className="mobile-hide" onClick={() => handleSort('gender')}>Gender <SortIcon field="gender" currentField={sortField} direction={sortDir} /></th>
                <th className="mobile-hide" onClick={() => handleSort('citizenship')}>Citizenship <SortIcon field="citizenship" currentField={sortField} direction={sortDir} /></th>
                <th className="mobile-hide" onClick={() => handleSort('membership_status')}>Status <SortIcon field="membership_status" currentField={sortField} direction={sortDir} /></th>
                <th className="mobile-hide" onClick={() => handleSort('membership_type')}>Type <SortIcon field="membership_type" currentField={sortField} direction={sortDir} /></th>
                <th className="mobile-hide" onClick={() => handleSort('date_of_membership')}>Member Since <SortIcon field="date_of_membership" currentField={sortField} direction={sortDir} /></th>
                <th style={{ width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state" style={{ padding: '48px 20px' }}>
                      <div className="empty-state-icon"><UsersIcon size={40} /></div>
                      <div className="empty-state-text">No members found</div>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(member => (
                <tr key={member.id}>
                  <td>
                    <div className="table-member-name">
                      {member.profile_picture ? (
                        <div className="table-avatar" style={{ background: 'none', border: '2px solid var(--border)', overflow: 'hidden', padding: 0 }}>
                          <img src={member.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        </div>
                      ) : (
                        <div className={getAvatarClass(member.gender)}>{getInitials(member)}</div>
                      )}
                      <div>
                        <div className="member-name">
                          {member.last_name}, {member.first_name} {member.middle_name ? member.middle_name[0] + '.' : ''} {member.prefix || ''}
                        </div>
                        {member.family_groups?.name && (
                          <div className="member-name-family">{member.family_groups.name}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="mobile-hide" style={{ color: 'var(--text-primary)' }}>
                    {calculateAge(member.date_of_birth) ?? '—'}
                  </td>
                  <td className="mobile-hide" style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                    {member.gender || '—'}
                  </td>
                  <td className="mobile-hide" style={{ color: 'var(--text-secondary)' }}>{member.citizenship || '—'}</td>
                  <td className="mobile-hide">
                    <span className={`badge badge-${member.membership_status}`}>
                      {getStatusLabel(member.membership_status)}
                    </span>
                  </td>
                  <td className="mobile-hide">
                    {member.membership_type ? (
                      <span className={`badge badge-${member.membership_type}`}>
                        {capitalize(member.membership_type)}
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="mobile-hide" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {member.date_of_membership ? membershipDateToYear(member.date_of_membership) : '—'}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        title="View"
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => router.push(`/members/${member.id}`)}
                      ><EyeIcon size={16} /></button>
                      <button
                        title="Edit"
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => router.push(`/members/${member.id}/edit`)}
                      ><EditIcon size={16} /></button>
                      <button
                        title="Delete"
                        className="btn btn-danger btn-icon btn-sm"
                        onClick={() => onDelete(member)}
                      ><TrashIcon size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
