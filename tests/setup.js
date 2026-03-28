import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock window.scrollTo
window.scrollTo = () => {}

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}
global.localStorage = localStorageMock
