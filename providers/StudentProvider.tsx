'use client'

/**
 * providers/StudentProvider.tsx — Server → Client data bridge for student context
 *
 * Server Component (layout.tsx) fetches student data and enrollments,
 * then wraps children in this provider. Client Components consume via useStudentContext().
 *
 * This provider is thin — no fetching, just passes through server data.
 */

import { createContext, useContext } from 'react'
import type { EnrollmentStatus } from '@/types/domain'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type StudentData = {
  id: string
  name: string
  email: string
  phone: string | null
}

export type StudentEnrollment = {
  id: string
  cohortId: string
  courseName: string
  teacherName: string
  status: EnrollmentStatus
}

type StudentContextType = {
  student: StudentData
  enrollments: ReadonlyArray<StudentEnrollment>
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const StudentContext = createContext<StudentContextType | null>(null)

export function useStudentContext() {
  const ctx = useContext(StudentContext)
  if (!ctx) {
    throw new Error('useStudentContext must be used within StudentProvider')
  }
  return ctx
}

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

type StudentProviderProps = {
  student: StudentData
  enrollments: StudentEnrollment[]
  children: React.ReactNode
}

export function StudentProvider({
  student,
  enrollments,
  children,
}: StudentProviderProps) {
  return (
    <StudentContext.Provider value={{ student, enrollments }}>
      {children}
    </StudentContext.Provider>
  )
}
