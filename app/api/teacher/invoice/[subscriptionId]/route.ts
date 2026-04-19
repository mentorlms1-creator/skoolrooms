import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToBuffer } = require('@react-pdf/renderer') as {
  renderToBuffer: (element: unknown) => Promise<Buffer>
}
import { createElement } from 'react'
import { createClient, createAdminClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { InvoiceDocument } from '@/components/teacher/InvoiceDocument'
import { formatPKT } from '@/lib/time/pkt'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> },
) {
  const { subscriptionId } = await params

  const supabaseClient = await createClient()
  const {
    data: { user },
  } = await supabaseClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const teacher = await getTeacherByAuthId(user.id)
  if (!teacher) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: subscription, error } = await supabase
    .from('teacher_subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single()

  if (error || !subscription) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  if ((subscription.teacher_id as string) !== teacher.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if ((subscription.status as string) !== 'approved') {
    return NextResponse.json({ error: 'Invoice not available yet' }, { status: 409 })
  }

  const pdfElement = createElement(InvoiceDocument, {
    invoiceId: subscription.id as string,
    teacherName: teacher.name as string,
    teacherEmail: teacher.email as string,
    plan: subscription.plan as string,
    amountPkr: subscription.amount_pkr as number,
    paymentMethod: subscription.payment_method as string,
    status: subscription.status as string,
    periodStart: formatPKT(subscription.period_start as string, 'date'),
    periodEnd: formatPKT(subscription.period_end as string, 'date'),
    issuedAt: formatPKT((subscription.approved_at as string | null) ?? (subscription.created_at as string), 'date'),
  })

  const pdfBuffer = await renderToBuffer(pdfElement)

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${subscription.id}.pdf"`,
    },
  })
}
