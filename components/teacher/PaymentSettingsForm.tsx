'use client'

/**
 * components/teacher/PaymentSettingsForm.tsx — Payment settings form
 * Bank name, IBAN, JazzCash, EasyPaisa, QR code, instructions.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/Textarea'
import { Card } from '@/components/ui/card'
import { updatePaymentSettingsAction } from '@/lib/actions/teacher-settings'

type PaymentSettingsFormProps = {
  initialData: {
    bankName: string
    accountTitle: string
    iban: string
    jazzcashNumber: string
    easypaisaNumber: string
    instructions: string
    qrCodeUrl: string
  }
}

export function PaymentSettingsForm({ initialData }: PaymentSettingsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const formData = new FormData(e.currentTarget)
    const result = await updatePaymentSettingsAction(formData)

    if (result.success) {
      setMessage({ type: 'success', text: 'Payment settings saved.' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error })
    }

    setLoading(false)
  }

  return (
    <Card className="p-6">
      {message && (
        <div
          className={`mb-4 rounded-md px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bank Transfer Section */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Bank Transfer</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bank_name">Bank Name</Label>
              <Input
                id="bank_name"
                name="bank_name"
                defaultValue={initialData.bankName}
                placeholder="e.g., HBL, Meezan Bank"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account_title">Account Title</Label>
              <Input
                id="account_title"
                name="account_title"
                defaultValue={initialData.accountTitle}
                placeholder="Name on bank account"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                name="iban"
                defaultValue={initialData.iban}
                placeholder="PK00ABCD0000000000000000"
              />
            </div>
          </div>
        </div>

        {/* Mobile Wallet Section */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Mobile Wallets</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jazzcash_number">JazzCash Number</Label>
              <Input
                id="jazzcash_number"
                name="jazzcash_number"
                defaultValue={initialData.jazzcashNumber}
                placeholder="03xx-xxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="easypaisa_number">EasyPaisa Number</Label>
              <Input
                id="easypaisa_number"
                name="easypaisa_number"
                defaultValue={initialData.easypaisaNumber}
                placeholder="03xx-xxxxxxx"
              />
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">QR Code</h3>
          <div className="space-y-2">
            <Label htmlFor="qr_code_url">QR Code URL</Label>
            <Input
              id="qr_code_url"
              name="qr_code_url"
              defaultValue={initialData.qrCodeUrl}
              placeholder="Upload QR code via File Upload above, paste URL here"
            />
          </div>
          {initialData.qrCodeUrl && (
            <div className="mt-2">
              <Image
                src={initialData.qrCodeUrl}
                alt="Payment QR Code"
                width={128}
                height={128}
                className="rounded border border-border object-contain"
                sizes="128px"
              />
            </div>
          )}
        </div>

        {/* Instructions */}
        <Textarea
          label="Payment Instructions for Students"
          name="instructions"
          defaultValue={initialData.instructions}
          placeholder="e.g., Send to HBL account 1234567890, share screenshot after payment"
          rows={3}
        />

        <p className="text-xs text-muted-foreground">
          At least one payment method (IBAN, JazzCash, or EasyPaisa) must be provided.
        </p>

        <div className="flex justify-end pt-2">
          <Button type="submit" loading={loading}>
            Save Payment Settings
          </Button>
        </div>
      </form>
    </Card>
  )
}
