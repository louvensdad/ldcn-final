# Prisma/PostgreSQL adapter

O schema cobre os contratos append-only do `core`: eventos de decisão, outcomes,
dispatches idempotentes, snapshots de falha, advisories de repair e avaliações
de gates.

Para ativar:

```bash
cd infra/prisma
npx prisma generate --schema schema.prisma
npx prisma migrate dev --schema schema.prisma --name init
```

O adapter de aplicação deve preservar as regras já implementadas no core:

- `idempotencyKey` não pode ser reutilizada entre missões;
- `(missionId, version)` é monotônico e único;
- eventos são append-only;
- payloads não podem conter secrets nem reasoning privado;
- writes concorrentes devem usar transação e conflito otimista.
