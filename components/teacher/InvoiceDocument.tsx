/**
 * components/teacher/InvoiceDocument.tsx
 * Lightweight @react-pdf invoice for teacher subscription receipts.
 */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11, color: '#1a1a1a' },
  header: { marginBottom: 24 },
  platformName: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  tagline: { fontSize: 10, color: '#666', marginBottom: 24 },
  invoiceMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  block: { flexDirection: 'column', gap: 4 },
  label: { fontSize: 8, color: '#666', textTransform: 'uppercase', letterSpacing: 1 },
  value: { fontSize: 11 },
  table: { marginTop: 8, borderWidth: 1, borderColor: '#eee' },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableRow: { flexDirection: 'row', padding: 6 },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: 'right' },
  total: {
    flexDirection: 'row',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    marginTop: 8,
  },
  bold: { fontFamily: 'Helvetica-Bold' },
  footer: { marginTop: 40, fontSize: 8, color: '#888', textAlign: 'center' },
})

type Props = {
  invoiceId: string
  teacherName: string
  teacherEmail: string
  plan: string
  amountPkr: number
  paymentMethod: string
  status: string
  periodStart: string
  periodEnd: string
  issuedAt: string
}

export function InvoiceDocument(props: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.platformName}>Skool Rooms</Text>
          <Text style={styles.tagline}>Subscription invoice</Text>
        </View>

        <View style={styles.invoiceMeta}>
          <View style={styles.block}>
            <Text style={styles.label}>Billed to</Text>
            <Text style={styles.value}>{props.teacherName}</Text>
            <Text style={styles.value}>{props.teacherEmail}</Text>
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>Invoice</Text>
            <Text style={styles.value}>{props.invoiceId}</Text>
            <Text style={styles.label}>Issued</Text>
            <Text style={styles.value}>{props.issuedAt}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.col1, styles.bold]}>Description</Text>
            <Text style={[styles.col2, styles.bold]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <View style={styles.col1}>
              <Text style={styles.bold}>{props.plan} plan</Text>
              <Text>
                {props.periodStart} — {props.periodEnd}
              </Text>
              <Text style={{ color: '#666' }}>
                Method: {props.paymentMethod} · Status: {props.status}
              </Text>
            </View>
            <Text style={styles.col2}>Rs. {props.amountPkr.toLocaleString()}</Text>
          </View>
          <View style={styles.total}>
            <Text style={[styles.col1, styles.bold]}>Total paid</Text>
            <Text style={[styles.col2, styles.bold]}>Rs. {props.amountPkr.toLocaleString()}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Thank you for using Skool Rooms. This invoice is generated automatically.
        </Text>
      </Page>
    </Document>
  )
}
