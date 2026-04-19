import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 60,
    fontFamily: 'Helvetica',
    backgroundColor: '#fefefe',
    color: '#1a1a1a',
  },
  outerBorder: {
    position: 'absolute',
    top: 30,
    left: 30,
    right: 30,
    bottom: 30,
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  innerBorder: {
    position: 'absolute',
    top: 38,
    left: 38,
    right: 38,
    bottom: 38,
    borderWidth: 1,
    borderColor: '#888',
  },
  brand: {
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  platformName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 4,
  },
  certTitle: {
    textAlign: 'center',
    fontSize: 36,
    fontFamily: 'Helvetica-Bold',
    marginTop: 16,
    marginBottom: 4,
  },
  certSubtitle: {
    textAlign: 'center',
    fontSize: 12,
    color: '#555',
    letterSpacing: 2,
    marginBottom: 36,
  },
  awardedTo: {
    textAlign: 'center',
    fontSize: 11,
    color: '#555',
    marginBottom: 8,
  },
  studentNameWrap: {
    marginHorizontal: 80,
    marginBottom: 28,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  studentName: {
    textAlign: 'center',
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
  },
  bodyLine: {
    textAlign: 'center',
    fontSize: 12,
    color: '#333',
    lineHeight: 1.6,
    marginBottom: 4,
  },
  courseTitle: {
    fontFamily: 'Helvetica-Bold',
  },
  footerRow: {
    flexDirection: 'row',
    marginTop: 40,
    paddingHorizontal: 40,
    justifyContent: 'space-between',
  },
  footerCol: {
    flex: 1,
    alignItems: 'center',
  },
  footerValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  footerLabel: {
    fontSize: 9,
    color: '#666',
    marginTop: 4,
    letterSpacing: 1,
  },
  certNumber: {
    position: 'absolute',
    bottom: 50,
    right: 60,
    fontSize: 8,
    color: '#888',
  },
})

export type CertificateDocumentProps = {
  studentName: string
  cohortName: string
  courseName: string
  teacherName: string
  startDate: string
  endDate: string
  issuedDate: string
  certificateNumber: string
}

export function CertificateDocument({
  studentName,
  cohortName,
  courseName,
  teacherName,
  startDate,
  endDate,
  issuedDate,
  certificateNumber,
}: CertificateDocumentProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.outerBorder} />
        <View style={styles.innerBorder} />

        <View style={styles.brand}>
          <Text style={styles.platformName}>SKOOL ROOMS</Text>
        </View>

        <Text style={styles.certTitle}>CERTIFICATE OF COMPLETION</Text>
        <Text style={styles.certSubtitle}>THIS IS TO CERTIFY THAT</Text>

        <View style={styles.studentNameWrap}>
          <Text style={styles.studentName}>{studentName}</Text>
        </View>

        <Text style={styles.bodyLine}>has successfully completed the course</Text>
        <Text style={[styles.bodyLine, styles.courseTitle]}>{courseName}</Text>
        <Text style={styles.bodyLine}>as part of the cohort &quot;{cohortName}&quot;</Text>
        <Text style={styles.bodyLine}>
          held from {startDate} to {endDate}
        </Text>

        <View style={styles.footerRow}>
          <View style={styles.footerCol}>
            <Text style={styles.footerValue}>{teacherName}</Text>
            <Text style={styles.footerLabel}>TEACHER</Text>
          </View>
          <View style={styles.footerCol}>
            <Text style={styles.footerValue}>{issuedDate}</Text>
            <Text style={styles.footerLabel}>ISSUED ON</Text>
          </View>
        </View>

        <Text style={styles.certNumber}>{certificateNumber}</Text>
      </Page>
    </Document>
  )
}
