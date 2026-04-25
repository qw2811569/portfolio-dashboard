import { createSingletonStore } from './singleton-store.js'

export const NEWS_FEED_KEY = 'news-feed/latest.json'

export const newsFeedStore = createSingletonStore({
  keyspaceId: 'news.feed',
  loggerPrefix: 'news-feed-store',
  envPrefix: 'NEWS_FEED',
  access: 'public',
  bucketClass: 'public',
  contentType: 'application/json',
  cacheControl: 'public, max-age=0, must-revalidate',
  format: 'json',
  readMethod: 'get',
  vercelKey: () => NEWS_FEED_KEY,
})

export async function readNewsFeed(options = {}) {
  return newsFeedStore.read({}, options)
}

export async function writeNewsFeed(payload, options = {}) {
  return newsFeedStore.write({}, payload, options)
}

export async function headNewsFeed(options = {}) {
  return newsFeedStore.head({}, options)
}
