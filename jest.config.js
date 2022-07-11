// jest.config.js
require('nock').disableNetConnect();

module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testEnvironment: 'node',
  testRegex: ['./__tests__/.+\\.test\\.ts$', './__tests__/.+\\.spec\\.ts$'],
  testRunner: 'jest-circus/runner',
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },

  reporters: ['default', 'jest-junit'],
  setupFiles: ['dotenv/config'],
  verbose: true,
  testPathIgnorePatterns: ['/helpers/', '/node_modules/'],
  coveragePathIgnorePatterns: ['/node_modules/']
};
const regexPattern = /^::/;
const processStdoutWrite = process.stdout.write.bind(process.stdout);
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
process.stdout.write = (str, encoding, cb) => {
  // Core library will directly call process.stdout.write for commands
  // We don't want :: commands to be executed by the runner during tests
  if (regexPattern.test(str)) {
    return processStdoutWrite(str, encoding, cb);
  }
};
