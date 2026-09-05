/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        // The frontend fixtures/engine are ESM-flavoured TS; transpile them to
        // CJS for the test regardless of their package "type": "module".
        isolatedModules: true,
        tsconfig: {
          module: 'commonjs',
          target: 'es2021',
          esModuleInterop: true,
          allowJs: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          strict: false,
        },
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!.*)'],
};
