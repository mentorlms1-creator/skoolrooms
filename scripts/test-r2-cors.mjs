// Diagnostic: simulate the browser's CORS preflight against the R2 bucket
// for each origin we expect to be allowed. Pure HTTP — no AWS credentials
// needed (CORS preflight is unauthenticated by design).
//
// Run: `node --env-file=.env.local scripts/test-r2-cors.mjs`

const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT
const bucket = process.env.CLOUDFLARE_R2_BUCKET

if (!endpoint || !bucket) {
  console.error('Missing CLOUDFLARE_R2_ENDPOINT or CLOUDFLARE_R2_BUCKET')
  process.exit(1)
}

const probeUrl = `${endpoint.replace(/\/$/, '')}/${bucket}/__cors-probe__.txt`

const origins = [
  'https://skoolrooms.site',
  'https://teacher.skoolrooms.site',
  'https://skoolrooms.com',
  'https://teacher.skoolrooms.com',
  'http://localhost:3000',
  'https://evil.example.com', // should be REJECTED
]

let failed = false

for (const origin of origins) {
  const res = await fetch(probeUrl, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': 'content-type,content-length',
    },
  })

  const allowOrigin = res.headers.get('access-control-allow-origin')
  const allowMethods = res.headers.get('access-control-allow-methods')
  const allowHeaders = res.headers.get('access-control-allow-headers')

  // Browser considers preflight successful when response is 2xx AND
  // Access-Control-Allow-Origin matches the request Origin (or is '*').
  const isAllowed =
    res.ok && (allowOrigin === origin || allowOrigin === '*')

  const expectAllowed = origin !== 'https://evil.example.com'
  const correct = isAllowed === expectAllowed

  const verdict = correct ? '✓' : '✗'
  console.log(`${verdict} ${origin}`)
  console.log(`    status: ${res.status}`)
  console.log(`    allow-origin:  ${allowOrigin ?? '(absent)'}`)
  console.log(`    allow-methods: ${allowMethods ?? '(absent)'}`)
  console.log(`    allow-headers: ${allowHeaders ?? '(absent)'}`)
  console.log(`    expected ${expectAllowed ? 'ALLOWED' : 'REJECTED'} → actually ${isAllowed ? 'ALLOWED' : 'REJECTED'}`)
  console.log()

  if (!correct) failed = true
}

if (failed) {
  console.error('FAIL: at least one origin did not match expectations.')
  process.exit(1)
} else {
  console.log('PASS: all origins behave as expected.')
}
