/**
 * components/public/TeacherBio.tsx — Teacher profile bio section
 * Server Component. Used on the teacher's public subdomain page.
 */

import Image from 'next/image'

type TeacherBioProps = {
  name: string
  bio: string | null
  photoUrl: string | null
  subjectTags: string[]
  teachingLevels: string[]
}

export function TeacherBio({
  name,
  bio,
  photoUrl,
  subjectTags,
  teachingLevels,
}: TeacherBioProps) {
  const initial = name.charAt(0).toUpperCase()

  return (
    <div className="flex flex-col items-center text-center px-4 py-8">
      {/* Profile photo or initial avatar */}
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={name}
          width={96}
          height={96}
          className="h-24 w-24 rounded-full border border-border object-cover"
        />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-border bg-primary/20 text-primary text-3xl font-bold">
          {initial}
        </div>
      )}

      {/* Name */}
      <h1 className="mt-4 text-2xl font-bold text-foreground">{name}</h1>

      {/* Bio */}
      {bio && (
        <p className="mt-2 max-w-lg text-muted-foreground">{bio}</p>
      )}

      {/* Subject tags */}
      {subjectTags.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {subjectTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Teaching level tags */}
      {teachingLevels.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {teachingLevels.map((level) => (
            <span
              key={level}
              className="rounded-full border border-border bg-background px-3 py-1 text-sm text-muted-foreground"
            >
              {level}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
