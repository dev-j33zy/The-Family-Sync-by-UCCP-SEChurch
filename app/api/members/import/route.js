import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request) {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { members } = await request.json()

    if (!Array.isArray(members) || members.length === 0) {
      return Response.json({ error: 'No members to import' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('members')
      .insert(members.map(m => ({
        last_name: m.last_name,
        first_name: m.first_name,
        middle_name: m.middle_name || null,
        date_of_birth: m.date_of_birth,
        gender: m.gender || null,
        citizenship: m.citizenship || null,
        relationship_status: m.relationship_status || null,
        wedding_anniversary: m.wedding_anniversary || null,
        communicant_class_graduate: m.communicant_class_graduate || null,
        date_of_membership: m.date_of_membership || null,
        membership_status: m.membership_status || 'new',
        membership_type: m.membership_type || null,
        phone_number: m.phone_number || null,
        email_address: m.email_address || null,
        street_address: m.street_address || null,
        village: m.village || null,
        barangay: m.barangay || null,
        city: m.city || null,
      })))
      .select()

    if (error) throw error

    return Response.json({ data, count: data.length })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
