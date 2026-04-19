/**
 * app/(teacher-public)/[subdomain]/page.tsx — Teacher public profile page
 * Server Component. Fetches teacher and published courses by subdomain.
 */

import { notFound } from 'next/navigation'
import { getTeacherBySubdomain } from '@/lib/db/teachers'
import { getPublishedCoursesByTeacherWithCurriculum } from '@/lib/db/courses'
import { getPublishedTestimonialsByTeacher } from '@/lib/db/testimonials'
import { TeacherBio } from '@/components/public/TeacherBio'
import { CourseCard } from '@/components/public/CourseCard'
import { TestimonialsSection } from '@/components/public/TestimonialsSection'
import { EmptyState } from '@/components/ui/EmptyState'

type PageProps = {
  params: Promise<{ subdomain: string }>
}

export default async function TeacherPublicPage({ params }: PageProps) {
  const { subdomain } = await params

  const teacher = await getTeacherBySubdomain(subdomain)
  if (!teacher) {
    notFound()
  }

  const [courses, testimonials] = await Promise.all([
    getPublishedCoursesByTeacherWithCurriculum(teacher.id),
    getPublishedTestimonialsByTeacher(teacher.id),
  ])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Teacher bio */}
      <TeacherBio
        name={teacher.name}
        bio={teacher.bio}
        photoUrl={teacher.profile_photo_url}
        subjectTags={teacher.subject_tags}
        teachingLevels={teacher.teaching_levels}
      />

      {/* Courses section */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Courses</h2>

        {courses.length > 0 ? (
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                title={course.title}
                description={course.description}
                thumbnailUrl={course.thumbnail_url}
                category={course.category}
                tags={course.tags}
                curriculum={course.curriculum}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No courses yet"
            description="This teacher hasn't published any courses yet. Check back later!"
          />
        )}
      </section>

      {/* Testimonials section (only shown if teacher has published testimonials) */}
      <TestimonialsSection testimonials={testimonials} />
    </div>
  )
}
