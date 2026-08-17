/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  // Vários testes são de integração real (Postgres real, sem transação por teste) e alguns tocam
  // uma linha global única de credencial (GithubCredential/GitlabCredential id:"default") — Jest
  // roda arquivos de teste em processos paralelos por padrão, o que gera uma corrida real entre
  // arquivos diferentes na MESMA linha do banco. Serializa para nunca depender de sorte.
  maxWorkers: 1,
};
