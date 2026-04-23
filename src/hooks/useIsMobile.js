import { useEffect, useState } from 'react'

export const MOBILE_MEDIA_QUERY = '(max-width: 768px)'

function getMediaQueryMatch(query = MOBILE_MEDIA_QUERY) {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(query).matches
  )
}

export function useIsMobile(query = MOBILE_MEDIA_QUERY) {
  const [isMobile, setIsMobile] = useState(() => getMediaQueryMatch(query))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined

    const mediaQuery = window.matchMedia(query)
    const updateIsMobile = () => setIsMobile(mediaQuery.matches)

    updateIsMobile()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateIsMobile)
      return () => mediaQuery.removeEventListener('change', updateIsMobile)
    }

    mediaQuery.addListener(updateIsMobile)
    return () => mediaQuery.removeListener(updateIsMobile)
  }, [query])

  return isMobile
}
