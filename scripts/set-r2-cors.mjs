// One-off: configure CORS on the R2 bucket so the browser can PUT directly
// to presigned URLs from localhost (dev) and platform domain(s) (prod).
//
// Run: `node --env-file=.env.local scripts/set-r2-cors.mjs`
//
// During the .site → .com cutover both domains route to the same app, so the
// script reads NEXT_PUBLIC_PLATFORM_DOMAIN AND an optional comma-separated
// CORS_EXTRA_DOMAINS to grant CORS to every host that may serve the app.
// Example: CORS_EXTRA_DOMAINS=skoolrooms.com

import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3'

const bucket = process.env.CLOUDFLARE_R2_BUCKET
const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_KEY
const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN
const extraDomains = (process.env.CORS_EXTRA_DOMAINS ?? '')
  .split(',')
  .map((d) => d.trim())
  .filter(Boolean)

if (!bucket || !endpoint || !accessKeyId || !secretAccessKey || !platformDomain) {
  console.error('Missing one of: CLOUDFLARE_R2_BUCKET, CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_R2_ACCESS_KEY, CLOUDFLARE_R2_SECRET_KEY, NEXT_PUBLIC_PLATFORM_DOMAIN')
  process.exit(1)
}

const client = new S3Client({
  region: 'auto',
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
})

const platformDomains = [platformDomain, ...extraDomains]
const allowedOrigins = [
  'http://localhost:3000',
  ...platformDomains.flatMap((d) => [`https://${d}`, `https://*.${d}`]),
]

const cors = {
  Bucket: bucket,
  CORSConfiguration: {
    CORSRules: [
      {
        AllowedOrigins: allowedOrigins,
        AllowedMethods: ['PUT', 'GET', 'HEAD'],
        AllowedHeaders: ['content-type', 'content-length'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3600,
      },
    ],
  },
}

console.log(`Applying CORS to "${bucket}" with origins:`)
allowedOrigins.forEach((o) => console.log(`  - ${o}`))

await client.send(new PutBucketCorsCommand(cors))
console.log(`CORS applied to bucket "${bucket}"`)

const verify = await client.send(new GetBucketCorsCommand({ Bucket: bucket }))
console.log('Active rules:')
console.log(JSON.stringify(verify.CORSRules, null, 2))
