import assert from 'assert'

export { assert }

export function equals(actual, expected) {
  assert(actual === expected, `Expected ${actual} to equal ${expected}`)
}

export function notEquals(actual, expected) {
  assert(actual !== expected, `Expected ${actual} to not equal ${expected}`)
}

export function matches(actual, expected) {
  assert(actual.toString().match(expected), `Expected ${actual} to match ${expected}`)
}
