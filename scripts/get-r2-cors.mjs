// Diagnostic: print the CORS rules currently configured on the R2 bucket.
// Read-only counterpart to set-r2-cors.mjs.
//
// Run: `node --env-file=.env.local scripts/get-r2-cors.mjs`

import { S3Client, GetBucketCorsCommand } from '@aws-sdk/client-s3'

const bucket = process.env.CLOUDFLARE_R2_BUCKET
const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_KEY

if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
  console.error('Missing one of: CLOUDFLARE_R2_BUCKET, CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_R2_ACCESS_KEY, CLOUDFLARE_R2_SECRET_KEY')
  process.exit(1)
}

const client = new S3Client({
  region: 'auto',
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
})

try {
  const result = await client.send(new GetBucketCorsCommand({ Bucket: bucket }))
  console.log(`Bucket "${bucket}" CORS rules:`)
  console.log(JSON.stringify(result.CORSRules, null, 2))
} catch (err) {
  if (err.name === 'NoSuchCORSConfiguration') {
    console.log(`Bucket "${bucket}" has NO CORS configuration set.`)
  } else {
    throw err
  }
}
