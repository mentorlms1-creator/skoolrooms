import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Montserrat, Poppins } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { ViewTransitions } from "next-view-transitions";
import "./globals.css";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

// Marketing pages (/, /teachers, /pricing, /students, /explore) use the
// Montserrat + Poppins brand pairing. Exposed as CSS variables; unused
// elsewhere.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
  variable: "--font-montserrat",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "Skool Rooms — LMS for Tutors",
  description:
    "An LMS platform for independent tutors, home teachers, and small coaching centers.",
  icons: {
    icon: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${font.variable} ${montserrat.variable} ${poppins.variable} font-sans bg-background text-foreground antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <ViewTransitions>
            {children}
          </ViewTransitions>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
