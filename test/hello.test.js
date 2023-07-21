import assert from 'assert'
import { Fireproof } from '../dist/fireproof.esm.js'

describe('Hello World Test', function () {
  it('should pass the hello world test', function () {
    const result = Fireproof.storage('hello') // call to your library function
    assert(result.name === 'hello')
  })
})
