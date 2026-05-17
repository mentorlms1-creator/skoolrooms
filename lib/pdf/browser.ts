// =============================================================================
// lib/pdf/browser.ts — Singleton puppeteer browser instance.
// Holding one Chromium process across requests means each PDF render only
// spends ~50MB transient page memory. Idle browser holds ~200MB.
// Auto-relaunches on disconnect / crash.
//
// Local dev: PUPPETEER_EXECUTABLE_PATH points at the user's Chrome/Edge.
// Railway prod: PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser (apk).
// =============================================================================

import type { Browser, LaunchOptions } from 'puppeteer-core'

let browser: Browser | null = null
let launching: Promise<Browser> | null = null

export async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser
  if (launching) return launching

  const puppeteer = (await import('puppeteer-core')).default
  const launchOptions: LaunchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  }
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
  }
  launching = puppeteer.launch(launchOptions)
  browser = await launching
  launching = null

  // If the browser disconnects (crash / OOM), force relaunch on next call.
  browser.on('disconnected', () => {
    browser = null
  })

  return browser
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => {})
    browser = null
  }
}
