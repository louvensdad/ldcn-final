import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MarketplaceSolutionService, CreateSolutionInput, CreateVersionInput, SolutionStatus } from './marketplace-solution.service';

@Controller('marketplace/solutions')
export class MarketplaceSolutionController {
  constructor(private readonly solutions: MarketplaceSolutionService) {}

  @Post()
  create(@Body() body: CreateSolutionInput) {
    return this.solutions.createSolution(body);
  }

  @Get()
  list(@Query('status') status?: SolutionStatus) {
    return this.solutions.listSolutions(status ? { status } : undefined);
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.solutions.getSolutionBySlug(slug);
  }

  @Get(':solutionId/versions')
  listVersions(@Param('solutionId') solutionId: string) {
    return this.solutions.listVersions(solutionId);
  }

  @Post(':solutionId/versions')
  createVersion(@Param('solutionId') solutionId: string, @Body() body: CreateVersionInput) {
    return this.solutions.createVersionFromMission(solutionId, body);
  }

  @Get('versions/:versionId')
  getVersion(@Param('versionId') versionId: string) {
    return this.solutions.getVersion(versionId);
  }

  @Post('versions/:versionId/verify')
  verify(@Param('versionId') versionId: string) {
    return this.solutions.runVerificationGate(versionId);
  }

  @Post('versions/:versionId/publish')
  publish(@Param('versionId') versionId: string) {
    return this.solutions.publishVersion(versionId);
  }
}
