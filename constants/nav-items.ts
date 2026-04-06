/**
 * constants/nav-items.ts — Navigation item definitions for all roles.
 * Icons use lucide-react. Route constants from routes.ts.
 */

import {
  LayoutDashboard,
  BookOpen,
  Users,
  CreditCard,
  Wallet,
  BarChart3,
  Settings,
  Shield,
  Calendar,
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'

export type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

export const TEACHER_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: ROUTES.TEACHER.dashboard, icon: LayoutDashboard },
  { label: 'Courses', href: ROUTES.TEACHER.courses, icon: BookOpen },
  { label: 'Students', href: ROUTES.TEACHER.students, icon: Users },
  { label: 'Payments', href: ROUTES.TEACHER.payments, icon: CreditCard },
  { label: 'Earnings', href: ROUTES.TEACHER.earnings, icon: Wallet },
  { label: 'Analytics', href: ROUTES.TEACHER.analytics, icon: BarChart3 },
  { label: 'Settings', href: ROUTES.TEACHER.settings.root, icon: Settings },
]

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: ROUTES.ADMIN.dashboard, icon: LayoutDashboard },
  { label: 'Teachers', href: ROUTES.ADMIN.teachers, icon: Users },
  { label: 'Payments', href: ROUTES.ADMIN.payments, icon: CreditCard },
  { label: 'Settings', href: ROUTES.ADMIN.settings, icon: Settings },
  { label: 'Operations', href: ROUTES.ADMIN.operations, icon: Shield },
]

export const STUDENT_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: ROUTES.STUDENT.dashboard, icon: LayoutDashboard },
  { label: 'My Courses', href: ROUTES.STUDENT.courses, icon: BookOpen },
  { label: 'Schedule', href: ROUTES.STUDENT.schedule, icon: Calendar },
  { label: 'Payments', href: ROUTES.STUDENT.payments, icon: CreditCard },
  { label: 'Settings', href: ROUTES.STUDENT.settings, icon: Settings },
]
