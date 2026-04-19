/**
 * Route constants for the Skool Rooms LMS platform.
 * Never hardcode route strings — always import from here.
 *
 * Route map derived from ARCHITECTURE.md Section 10b.
 */

export const ROUTES = {
  // ═══════════════════════════════════════════
  // PLATFORM — skoolrooms.com public routes
  // ═══════════════════════════════════════════
  PLATFORM: {
    home: '/',
    explore: '/explore',
    pricing: '/pricing',
    login: '/login',
    teacherLogin: '/login/teacher',
    signup: '/signup',
    studentLogin: '/student-login',
    forgotPassword: '/forgot-password',
    resetPassword: '/auth/reset-password',
    studentForgotPassword: '/student-forgot-password',
    subscribe: '/subscribe',
    adminLogin: '/admin-login',
    onboarding: {
      step1: '/onboarding/step-1',
      step2: '/onboarding/step-2',
      step3: '/onboarding/step-3',
    },
  },

  // ═══════════════════════════════════════════
  // TEACHER — skoolrooms.com/dashboard/*
  // ═══════════════════════════════════════════
  TEACHER: {
    dashboard: '/dashboard',
    courses: '/dashboard/courses',
    courseNew: '/dashboard/courses/new',
    courseDetail: (id: string) => `/dashboard/courses/${id}` as const,
    courseEdit: (id: string) => `/dashboard/courses/${id}/edit` as const,
    courseCurriculum: (id: string) => `/dashboard/courses/${id}/curriculum` as const,
    cohortNew: (courseId: string) => `/dashboard/courses/${courseId}/cohorts/new` as const,
    cohortDetail: (courseId: string, cohortId: string) =>
      `/dashboard/courses/${courseId}/cohorts/${cohortId}` as const,
    cohortEdit: (courseId: string, cohortId: string) =>
      `/dashboard/courses/${courseId}/cohorts/${cohortId}/edit` as const,
    cohortStudents: (courseId: string, cohortId: string) =>
      `/dashboard/courses/${courseId}/cohorts/${cohortId}/students` as const,
    cohortSchedule: (courseId: string, cohortId: string) =>
      `/dashboard/courses/${courseId}/cohorts/${cohortId}/schedule` as const,
    cohortAnnouncements: (courseId: string, cohortId: string) =>
      `/dashboard/courses/${courseId}/cohorts/${cohortId}/announcements` as const,
    cohortAssignments: (courseId: string, cohortId: string) =>
      `/dashboard/courses/${courseId}/cohorts/${cohortId}/assignments` as const,
    cohortAttendance: (courseId: string, cohortId: string) =>
      `/dashboard/courses/${courseId}/cohorts/${cohortId}/attendance` as const,
    cohortPayments: (courseId: string, cohortId: string) =>
      `/dashboard/courses/${courseId}/cohorts/${cohortId}/payments` as const,
    students: '/dashboard/students',
    studentDetail: (studentId: string) => `/dashboard/students/${studentId}` as const,
    studentsHealth: '/dashboard/students/health',
    payments: '/dashboard/payments',
    paymentHistory: '/dashboard/payments/history',
    earnings: '/dashboard/earnings',
    analytics: '/dashboard/analytics',
    settings: {
      root: '/dashboard/settings',
      profile: '/dashboard/settings',
      plan: '/dashboard/settings/plan',
      notifications: '/dashboard/settings/notifications',
      payment: '/dashboard/settings/payments',
      billing: '/dashboard/settings/billing',
    },
    messages: '/dashboard/messages',
    messageThread: (threadId: string) => `/dashboard/messages/${threadId}` as const,
  },

  // ═══════════════════════════════════════════
  // STUDENT — students.skoolrooms.com/*
  // ═══════════════════════════════════════════
  STUDENT: {
    dashboard: '/student',
    courses: '/student/courses',
    enrollmentDetail: (enrollmentId: string) => `/student/courses/${enrollmentId}` as const,
    schedule: '/student/schedule',
    payments: '/student/payments',
    messages: '/student/messages',
    messageThread: (threadId: string) => `/student/messages/${threadId}` as const,
    settings: '/student/settings',
    forgotPassword: '/forgot-password',
    certificateDownload: (enrollmentId: string) =>
      `/api/student/certificate/${enrollmentId}` as const,
  },

  // ═══════════════════════════════════════════
  // ADMIN — skoolrooms.com/admin/*
  // ═══════════════════════════════════════════
  ADMIN: {
    dashboard: '/admin',
    teachers: '/admin/teachers',
    teachersWithCursor: (cursor: string) =>
      `/admin/teachers?cursor=${encodeURIComponent(cursor)}` as const,
    teacherDetail: (id: string) => `/admin/teachers/${id}` as const,
    activity: '/admin/activity',
    payments: '/admin/payments',
    payouts: '/admin/payouts',
    payoutsHistory: (cursor?: string) =>
      cursor
        ? (`/admin/payouts?cursor=${encodeURIComponent(cursor)}` as const)
        : ('/admin/payouts' as const),
    plans: '/admin/plans',
    planDetail: (planId: string) => `/admin/plans/${planId}` as const,
    settings: '/admin/settings',
    operations: '/admin/operations',
    analytics: '/admin/analytics',
    earnings: '/admin/earnings',
    metricsAdvanced: '/admin/metrics/advanced',
  },

  // ═══════════════════════════════════════════
  // PUBLIC — [subdomain].skoolrooms.com/*
  // ═══════════════════════════════════════════
  PUBLIC: {
    teacherPage: (subdomain: string) => `/${subdomain}` as const,
    teacherCourse: (subdomain: string, courseId: string) =>
      `/${subdomain}/courses/${courseId}` as const,
    joinCohort: (token: string) => `/join/${token}` as const,
    pay: (token: string, enrollmentId: string) =>
      `/join/${token}/pay/${enrollmentId}` as const,
  },

  // ═══════════════════════════════════════════
  // API — webhooks, crons, auth, external integrations
  // ═══════════════════════════════════════════
  API: {
    auth: {
      teacherSignup: '/api/auth/teacher/signup',
      teacherResendVerification: '/api/auth/teacher/resend-verification',
      teacherChangeEmail: '/api/auth/teacher/change-email',
      studentSignup: '/api/auth/student/signup',
      resetPassword: '/api/auth/reset-password',
      updatePassword: '/api/auth/update-password',
    },
    cloudflare: {
      subdomain: '/api/cloudflare/subdomain',
    },
    r2: {
      presign: '/api/r2/presign',
    },
    webhooks: {
      payment: '/api/webhooks/payment',
    },
    cron: {
      archiveCohorts: '/api/cron/archive-cohorts',
      feeReminders: '/api/cron/fee-reminders',
      classReminders: '/api/cron/class-reminders',
      trialExpiry: '/api/cron/trial-expiry',
      renewalReminders: '/api/cron/renewal-reminders',
      reconcile: '/api/cron/reconcile',
      gracePeriod: '/api/cron/grace-period',
      enrollmentNudge: '/api/cron/enrollment-nudge',
      subscriptionNudge: '/api/cron/subscription-nudge',
    },
    // NOTE: Per CLAUDE.md rule 12, all CRUD mutations use Server Actions
    // (in lib/actions/*.ts), NOT API routes. Only webhooks, crons, and
    // external integrations have API routes. The routes below are the
    // legitimate API routes only.
    public: {
      cohortPaymentInfo: (token: string) => `/api/public/cohort/${token}/payment-info` as const,
      validateDiscount: '/api/validate-discount',
    },
  },
} as const
