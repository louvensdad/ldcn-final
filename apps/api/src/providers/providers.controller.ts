import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ProviderCredentialPersistenceService } from './provider-credential-persistence.service';

export interface SaveCredentialInput {
  apiKey: string;
  model?: string;
}

@Controller('providers')
export class ProvidersController {
  constructor(private readonly providers: ProviderCredentialPersistenceService) {}

  @Get()
  list() {
    return this.providers.list();
  }

  @Post(':provider/credential')
  save(@Param('provider') provider: string, @Body() body: SaveCredentialInput) {
    return this.providers.save(provider, body.apiKey, body.model);
  }

  @Post(':provider/credential/test')
  test(@Param('provider') provider: string) {
    return this.providers.test(provider);
  }

  @Delete(':provider/credential')
  revoke(@Param('provider') provider: string) {
    return this.providers.revoke(provider);
  }
}
