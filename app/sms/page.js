import { notFound } from 'next/navigation'
import { SMS_ENABLED } from '@/lib/features'
import SmsClient from './SmsClient'

// SMS / text blasts are hidden for now. The UI lives in SmsClient.js and is
// only rendered once SMS_ENABLED is flipped back on (lib/features.js).
export default function SmsPage() {
  if (!SMS_ENABLED) notFound()
  return <SmsClient />
}
