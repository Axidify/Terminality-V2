// @ts-nocheck
import { test, expect } from 'vitest'

test('sanity test: test runner works', () => {
  expect(1 + 1).toBe(2)
})
import { describe, it, expect } from 'vitest'

describe('Sanity', () => {
  it('runs the test harness', () => {
    expect(true).toBe(true)
  })
})
