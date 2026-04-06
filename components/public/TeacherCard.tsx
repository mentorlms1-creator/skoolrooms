/**
 * components/public/TeacherCard.tsx — Teacher card for the explore page
 * Displays photo, name, subjects, levels, starting fee, student count, city.
 * Greyed "Not accepting students" when all cohorts are closed.
 * Server-compatible (no 'use client' needed).
 */

import Image from 'next/image'
import { Card } from '@/components/ui/card'
import type { ExplorableTeacher } from '@/lib/db/explore'

type TeacherCardProps = {
  teacher: ExplorableTeacher
  platformDomain: string
}

function formatFeePKR(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK')}`
}

export function TeacherCard({ teacher, platformDomain }: TeacherCardProps) {
  const profileUrl = `https://${teacher.subdomain}.${platformDomain}`

  return (
    <Card className="flex flex-col overflow-hidden hover:shadow-md transition-shadow">
      <a href={profileUrl} className="block">
        {/* Teacher photo */}
        <div className="flex items-center justify-center bg-background p-6 pb-4">
          {teacher.profile_photo_url ? (
            <Image
              src={teacher.profile_photo_url}
              alt={teacher.name}
              width={80}
              height={80}
              className="h-20 w-20 rounded-full object-cover border-2 border-border"
              sizes="80px"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-2xl font-bold text-primary">
              {teacher.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Teacher info */}
        <div className="flex flex-1 flex-col p-4 pt-0">
          {/* Name + City */}
          <h3 className="text-lg font-semibold text-foreground">{teacher.name}</h3>
          {teacher.city && (
            <p className="mt-0.5 text-sm text-muted-foreground">{teacher.city}</p>
          )}

          {/* Bio */}
          {teacher.bio && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{teacher.bio}</p>
          )}

          {/* Subject tags */}
          {teacher.subject_tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {teacher.subject_tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {tag}
                </span>
              ))}
              {teacher.subject_tags.length > 4 && (
                <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                  +{teacher.subject_tags.length - 4}
                </span>
              )}
            </div>
          )}

          {/* Teaching levels */}
          {teacher.teaching_levels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {teacher.teaching_levels.slice(0, 3).map((level) => (
                <span
                  key={level}
                  className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground border border-border"
                >
                  {level}
                </span>
              ))}
              {teacher.teaching_levels.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{teacher.teaching_levels.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Stats row */}
          <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
            <div className="text-sm">
              <span className="font-semibold text-foreground">
                {formatFeePKR(teacher.starting_fee_pkr)}
              </span>
              <span className="text-xs text-muted-foreground"> starting</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {teacher.student_count} {teacher.student_count === 1 ? 'student' : 'students'}
            </div>
          </div>

          {/* Availability indicator */}
          {!teacher.has_open_cohorts && (
            <div className="mt-2 rounded-md bg-muted/10 px-3 py-1.5 text-center text-xs font-medium text-muted-foreground">
              Not accepting students
            </div>
          )}
        </div>
      </a>
    </Card>
  )
}
