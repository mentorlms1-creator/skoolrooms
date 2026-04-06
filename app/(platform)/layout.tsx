/**
 * app/(platform)/layout.tsx — Platform layout
 * Minimal wrapper for marketing pages and auth pages on the main domain (skoolrooms.com).
 * No sidebar — just wraps children.
 */

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
