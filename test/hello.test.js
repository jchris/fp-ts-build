import assert from 'assert'
import { Fireproof } from '../dist/fireproof.esm.js'
// import { describe, it } from 'mocha'

describe('Hello World Test', function () {
  it('should pass the hello world test', function () {
    const result = Fireproof.storage() // call to your library function
    assert.strictEqual(result, 'Hello, World!')
  })
})
