/**
 * @file jest.config.mjs — website module test config.
 * Covers website/** — views (home, legal, 404, project) and all public-site
 * components — against its own suites under website/tests.
 */
import path from 'node:path'
import { makeConfig, moduleNameMapper, TESTS_DIR } from '../shared/tests/jest.preset.mjs'

export default {
  ...makeConfig({ name: 'website', dir: 'website' }),
  moduleNameMapper: {
    // happy-dom has no 2d backend — the super-res stub lets suites drive
    // both arms (null → keep rung, bitmap → GPU re-upload) deterministically.
    '^@core/utils/ml/super-res\\.js$': path.join(TESTS_DIR, '__mocks__/super-res.js'),
    ...moduleNameMapper,
  },
}
