import { createSingletonStore } from './singleton-store.js'

export const DAILY_EVENTS_KEY = 'daily-events/latest.json'

export const dailyEventsStore = createSingletonStore({
  keyspaceId: 'event.daily_events',
  loggerPrefix: 'daily-events-store',
  envPrefix: 'DAILY_EVENTS',
  access: 'public',
  bucketClass: 'public',
  contentType: 'application/json',
  cacheControl: 'public, max-age=0, must-revalidate',
  format: 'json',
  readMethod: 'get',
  vercelKey: () => DAILY_EVENTS_KEY,
})

export async function readDailyEventsSnapshot(options = {}) {
  return dailyEventsStore.read({}, options)
}

export async function writeDailyEventsSnapshot(payload, options = {}) {
  return dailyEventsStore.write({}, payload, options)
}
