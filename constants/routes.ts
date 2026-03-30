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
    schedule: '/schedule',
    payments: '/billing',
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
    teacher: {
      onboarding: '/api/teacher/onboarding',
      onboardingCompleteStep: '/api/teacher/onboarding/complete-step',
      subscribe: '/api/teacher/subscribe',
      subscribeScreenshot: '/api/teacher/subscribe/screenshot',
      courses: '/api/teacher/courses',
      course: (id: string) => `/api/teacher/courses/${id}` as const,
      cohorts: '/api/teacher/cohorts',
      cohort: (id: string) => `/api/teacher/cohorts/${id}` as const,
      cohortArchive: (id: string) => `/api/teacher/cohorts/${id}/archive` as const,
      classSessions: '/api/teacher/class-sessions',
      classSessionCancel: (id: string) => `/api/teacher/class-sessions/${id}/cancel` as const,
      enrollmentApprove: (id: string) => `/api/teacher/enrollments/${id}/approve` as const,
      enrollmentReject: (id: string) => `/api/teacher/enrollments/${id}/reject` as const,
      enrollmentManual: '/api/teacher/enrollments/manual',
      enrollmentApproveWithdrawal: (id: string) =>
        `/api/teacher/enrollments/${id}/approve-withdrawal` as const,
      enrollmentRejectWithdrawal: (id: string) =>
        `/api/teacher/enrollments/${id}/reject-withdrawal` as const,
      createAndEnroll: '/api/teacher/students/create-and-enroll',
      announcements: '/api/teacher/announcements',
      assignments: '/api/teacher/assignments',
      attendance: '/api/teacher/attendance',
      payouts: '/api/teacher/payouts',
      discountCodes: '/api/teacher/discount-codes',
      discountCode: (id: string) => `/api/teacher/discount-codes/${id}` as const,
      settingsNotifications: '/api/teacher/settings/notifications',
      planDetails: '/api/teacher/plan-details',
      analyticsStorage: '/api/teacher/analytics/storage',
      analyticsExploreViews: '/api/teacher/analytics/explore-views',
      analyticsRevenue: '/api/teacher/analytics/revenue',
    },
    student: {
      enroll: '/api/student/enroll',
      waitlistJoin: '/api/student/waitlist/join',
      waitlistLeave: '/api/student/waitlist/leave',
      submissions: '/api/student/submissions',
      announcementRead: (id: string) => `/api/student/announcements/${id}/read` as const,
      enrollmentWithdraw: (id: string) => `/api/student/enrollments/${id}/withdraw` as const,
    },
    admin: {
      teacherResetPassword: (id: string) =>
        `/api/admin/teachers/${id}/reset-password` as const,
      teacherWipeTestAccount: (id: string) =>
        `/api/admin/teachers/${id}/wipe-test-account` as const,
      teacherChangePlan: (id: string) => `/api/admin/teachers/${id}/change-plan` as const,
      teacherExtendExpiry: (id: string) => `/api/admin/teachers/${id}/extend-expiry` as const,
      teacherExtendTrial: (id: string) => `/api/admin/teachers/${id}/extend-trial` as const,
      teacherSuspend: (id: string) => `/api/admin/teachers/${id}/suspend` as const,
      teacherReactivate: (id: string) => `/api/admin/teachers/${id}/reactivate` as const,
      teacherActivityLog: (id: string) =>
        `/api/admin/teachers/${id}/activity-log` as const,
      subscriptionApprove: (id: string) => `/api/admin/subscriptions/${id}/approve` as const,
      subscriptionReject: (id: string) => `/api/admin/subscriptions/${id}/reject` as const,
      payoutComplete: (id: string) => `/api/admin/payouts/${id}/complete` as const,
      payoutFail: (id: string) => `/api/admin/payouts/${id}/fail` as const,
      bulkEmail: '/api/admin/teachers/bulk-email',
      analytics: '/api/admin/analytics',
    },
    public: {
      cohortPaymentInfo: (token: string) => `/api/public/cohort/${token}/payment-info` as const,
      validateDiscount: '/api/validate-discount',
    },
    // Phase 2
    messages: {
      send: '/api/messages/send',
      thread: '/api/messages/thread',
      read: '/api/messages/read',
    },
    referrals: {
      generate: '/api/referrals/generate',
      convert: '/api/referrals/convert',
    },
    cohortFeedback: '/api/cohort/feedback',
  },
} as const
