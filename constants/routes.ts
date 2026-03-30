/**
 * Route constants for the Lumscribe LMS platform.
 * Never hardcode route strings — always import from here.
 *
 * Route map derived from ARCHITECTURE.md Section 10b.
 */

export const ROUTES = {
  // ═══════════════════════════════════════════
  // PLATFORM — lumscribe.com public routes
  // ═══════════════════════════════════════════
  PLATFORM: {
    home: '/',
    explore: '/explore',
    pricing: '/pricing',
    login: '/login',
    signup: '/signup',
    studentLogin: '/student-login',
    forgotPassword: '/forgot-password',
    resetPassword: '/auth/reset-password',
    studentForgotPassword: '/student-forgot-password',
    subscribe: '/subscribe',
    adminLogin: '/admin/login',
    onboarding: {
      step1: '/onboarding/step-1',
      step2: '/onboarding/step-2',
      step3: '/onboarding/step-3',
    },
  },

  // ═══════════════════════════════════════════
  // TEACHER — lumscribe.com/dashboard/*
  // ═══════════════════════════════════════════
  TEACHER: {
    dashboard: '/dashboard',
    courses: '/dashboard/courses',
    courseNew: '/dashboard/courses/new',
    courseDetail: (id: string) => `/dashboard/courses/${id}` as const,
    courseEdit: (id: string) => `/dashboard/courses/${id}/edit` as const,
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
  },

  // ═══════════════════════════════════════════
  // STUDENT — students.lumscribe.com/*
  // ═══════════════════════════════════════════
  STUDENT: {
    dashboard: '/',
    courses: '/courses',
    enrollmentDetail: (enrollmentId: string) => `/courses/${enrollmentId}` as const,
    schedule: '/schedule',
    payments: '/payments',
    messages: '/messages',
    settings: '/settings',
    forgotPassword: '/forgot-password',
  },

  // ═══════════════════════════════════════════
  // ADMIN — lumscribe.com/admin/*
  // ═══════════════════════════════════════════
  ADMIN: {
    dashboard: '/admin',
    teachers: '/admin/teachers',
    teacherDetail: (id: string) => `/admin/teachers/${id}` as const,
    payments: '/admin/payments',
    payouts: '/admin/payouts',
    plans: '/admin/plans',
    planDetail: (planId: string) => `/admin/plans/${planId}` as const,
    settings: '/admin/settings',
    operations: '/admin/operations',
    analytics: '/admin/analytics',
    earnings: '/admin/earnings',
  },

  // ═══════════════════════════════════════════
  // PUBLIC — [subdomain].lumscribe.com/*
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
