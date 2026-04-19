import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
  header: { marginBottom: 20 },
  platformName: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  generatedAt: { fontSize: 8, color: '#666' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 4 },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 130, color: '#555' },
  value: { flex: 1 },
  table: { marginTop: 4 },
  tableHead: { flexDirection: 'row', backgroundColor: '#f5f5f5', padding: 4 },
  tableRow: { flexDirection: 'row', padding: 4, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: 'right' },
  bold: { fontFamily: 'Helvetica-Bold' },
  footer: { marginTop: 30, fontSize: 8, color: '#888', textAlign: 'center' },
})

type AssignmentSummary = {
  title: string
  dueDate: string
  status: 'submitted' | 'reviewed' | 'overdue' | 'not_submitted'
}

type PaymentSummary = {
  month: string
  status: 'paid' | 'pending' | 'overdue'
}

type Props = {
  studentName: string
  cohortName: string
  courseName: string
  teacherName: string
  startDate: string
  endDate: string
  totalSessions: number
  attendedSessions: number
  assignments: AssignmentSummary[]
  payments: PaymentSummary[]
  isMonthly: boolean
  generatedAt: string
}

export function ProgressReportDocument({
  studentName,
  cohortName,
  courseName,
  teacherName,
  startDate,
  endDate,
  totalSessions,
  attendedSessions,
  assignments,
  payments,
  isMonthly,
  generatedAt,
}: Props) {
  const missedSessions = totalSessions - attendedSessions
  const attendancePct = totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 0

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.platformName}>Skool Rooms</Text>
          <Text style={styles.generatedAt}>Progress Report — Generated {generatedAt}</Text>
        </View>

        {/* Student Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Student Information</Text>
          <View style={styles.row}><Text style={styles.label}>Student</Text><Text style={styles.value}>{studentName}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Cohort</Text><Text style={styles.value}>{cohortName}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Course</Text><Text style={styles.value}>{courseName}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Teacher</Text><Text style={styles.value}>{teacherName}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Report Period</Text><Text style={styles.value}>{startDate} to {endDate}</Text></View>
        </View>

        {/* Attendance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance</Text>
          <View style={styles.row}><Text style={styles.label}>Total Sessions</Text><Text style={styles.value}>{totalSessions}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Attended</Text><Text style={styles.value}>{attendedSessions} ({attendancePct}%)</Text></View>
          <View style={styles.row}><Text style={styles.label}>Missed</Text><Text style={styles.value}>{missedSessions}</Text></View>
        </View>

        {/* Assignments */}
        {assignments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assignments</Text>
            <View style={styles.table}>
              <View style={styles.tableHead}>
                <Text style={[styles.col1, styles.bold]}>Assignment</Text>
                <Text style={[styles.col2, styles.bold]}>Due</Text>
                <Text style={[styles.col2, styles.bold]}>Status</Text>
              </View>
              {assignments.map((a, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.col1}>{a.title}</Text>
                  <Text style={styles.col2}>{a.dueDate}</Text>
                  <Text style={styles.col2}>{a.status.replace('_', ' ')}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Payments */}
        {isMonthly && payments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment History</Text>
            <View style={styles.table}>
              <View style={styles.tableHead}>
                <Text style={[styles.col1, styles.bold]}>Month</Text>
                <Text style={[styles.col2, styles.bold]}>Status</Text>
              </View>
              {payments.map((p, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.col1}>{p.month}</Text>
                  <Text style={styles.col2}>{p.status}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {!isMonthly && payments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <View style={styles.row}><Text style={styles.label}>Fee Status</Text><Text style={styles.value}>{payments[0]?.status ?? 'not paid'}</Text></View>
          </View>
        )}

        <Text style={styles.footer}>Skool Rooms — skoolrooms.com</Text>
      </Page>
    </Document>
  )
}
