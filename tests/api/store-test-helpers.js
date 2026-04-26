export function createJsonStream(value) {
  return new Response(JSON.stringify(value)).body
}
