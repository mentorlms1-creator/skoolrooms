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
  ArrowUpRight,
  MessageSquare,
  TrendingUp,
  Layers,
  Mail,
  ScrollText,
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'

export type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  group?: string
}

export const TEACHER_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: ROUTES.TEACHER.dashboard, icon: LayoutDashboard },
  { label: 'Courses', href: ROUTES.TEACHER.courses, icon: BookOpen },
  { label: 'Students', href: ROUTES.TEACHER.students, icon: Users },
  { label: 'Student Health', href: ROUTES.TEACHER.studentsHealth, icon: TrendingUp, group: 'Management' },
  { label: 'Messages', href: ROUTES.TEACHER.messages, icon: MessageSquare, group: 'Management' },
  { label: 'Payments', href: ROUTES.TEACHER.payments, icon: CreditCard, group: 'Management' },
  { label: 'Earnings', href: ROUTES.TEACHER.earnings, icon: Wallet, group: 'Management' },
  { label: 'Analytics', href: ROUTES.TEACHER.analytics, icon: BarChart3, group: 'Management' },
  { label: 'Settings', href: ROUTES.TEACHER.settings.root, icon: Settings, group: 'Preferences' },
]

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: ROUTES.ADMIN.dashboard, icon: LayoutDashboard },
  { label: 'Teachers', href: ROUTES.ADMIN.teachers, icon: Users },
  { label: 'Payments', href: ROUTES.ADMIN.payments, icon: CreditCard, group: 'Management' },
  { label: 'Payouts', href: ROUTES.ADMIN.payouts, icon: ArrowUpRight, group: 'Management' },
  { label: 'Earnings', href: ROUTES.ADMIN.earnings, icon: Wallet, group: 'Management' },
  { label: 'Plans', href: ROUTES.ADMIN.plans, icon: Layers, group: 'Management' },
  { label: 'Metrics', href: '/admin/metrics', icon: TrendingUp, group: 'Management' },
  { label: 'Email', href: '/admin/email', icon: Mail, group: 'Management' },
  { label: 'Activity', href: '/admin/activity', icon: ScrollText, group: 'Management' },
  { label: 'Settings', href: ROUTES.ADMIN.settings, icon: Settings, group: 'Management' },
  { label: 'Operations', href: ROUTES.ADMIN.operations, icon: Shield, group: 'Management' },
]

export const STUDENT_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: ROUTES.STUDENT.dashboard, icon: LayoutDashboard },
  { label: 'My Courses', href: ROUTES.STUDENT.courses, icon: BookOpen },
  { label: 'Schedule', href: ROUTES.STUDENT.schedule, icon: Calendar },
  { label: 'Messages', href: ROUTES.STUDENT.messages, icon: MessageSquare, group: 'Account' },
  { label: 'Payments', href: ROUTES.STUDENT.payments, icon: CreditCard, group: 'Account' },
  { label: 'Settings', href: ROUTES.STUDENT.settings, icon: Settings, group: 'Account' },
]
