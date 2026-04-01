/**
 * app/(teacher)/dashboard/settings/payments/page.tsx — Teacher payment settings
 *
 * Server Component. Displays bank/wallet details for teacher payouts.
 */

import type { Metadata } from 'next'
import { requireTeacher } from '@/lib/auth/guards'
import { getTeacherPaymentSettings } from '@/lib/db/admin'
import { PageHeader } from '@/components/ui/PageHeader'
import { PaymentSettingsForm } from '@/components/teacher/PaymentSettingsForm'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Payment Settings \u2014 Lumscribe',
}

export default async function TeacherPaymentSettingsPage() {
  const teacher = await requireTeacher()
  const settings = await getTeacherPaymentSettings(teacher.id)

  return (
    <>
      <PageHeader
        title="Payment Settings"
        description="Configure how students pay you and how you receive payouts."
        backHref={ROUTES.TEACHER.settings.root}
      />

      <PaymentSettingsForm
        initialData={{
          bankName: settings?.payout_bank_name ?? '',
          accountTitle: settings?.payout_account_title ?? '',
          iban: settings?.payout_iban ?? '',
          jazzcashNumber: settings?.jazzcash_number ?? '',
          easypaisaNumber: settings?.easypaisa_number ?? '',
          instructions: settings?.instructions ?? '',
          qrCodeUrl: settings?.qr_code_url ?? '',
        }}
      />
    </>
  )
}
