import assert from 'assert'

export { assert }

export function equals(actual, expected) {
  assert(actual === expected, `Expected ${actual} to equal ${expected}`)
}
