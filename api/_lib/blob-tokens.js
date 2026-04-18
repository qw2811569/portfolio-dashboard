export function getPrivateBlobToken() {
  return String(
    process.env.BLOB_READ_WRITE_TOKEN || process.env.PUB_BLOB_READ_WRITE_TOKEN || ''
  ).trim()
}

export function getTelemetryBlobToken() {
  return String(
    process.env.PUB_BLOB_TELEMETRY_TOKEN || process.env.PUB_BLOB_READ_WRITE_TOKEN || ''
  ).trim()
}
