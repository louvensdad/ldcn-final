import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { VirtualCompanyService } from './virtual-company.service';

@Controller('missions/:missionId/virtual-company')
export class VirtualCompanyController {
  constructor(private readonly companies: VirtualCompanyService) {}

  @Post('compose')
  compose(@Param('missionId') missionId: string, @Body() body: { architectureCompositionId: string; implementationPlanId: string }) {
    return this.companies.compose(missionId, body.architectureCompositionId, body.implementationPlanId);
  }

  @Get('active')
  active(@Param('missionId') missionId: string) {
    return this.companies.getActive(missionId);
  }
}
