import { RequirementsController } from '../requirements/requirements.controller';

describe('CORE-011 production integration — explicit Discovery to Requirement extraction action', () => {
  it('POST extract resolves the persisted Discovery idea and calls RequirementExtractionService', async () => {
    const extractAndPersist = jest.fn().mockResolvedValue({ requirements: [] });
    const prisma = { discoveryConversation: { findUnique: jest.fn().mockResolvedValue({ rawUserIdea: 'Demo API with structured requirements' }) } };
    const controller = new RequirementsController(prisma as never, { extractAndPersist } as never, {} as never, {} as never);

    await controller.extract('mission-1', {});

    expect(prisma.discoveryConversation.findUnique).toHaveBeenCalledWith({ where: { missionId: 'mission-1' } });
    expect(extractAndPersist).toHaveBeenCalledWith('mission-1', 'Demo API with structured requirements');
  });

  it('an explicitly supplied idea uses the same real extraction action without querying Discovery again', async () => {
    const extractAndPersist = jest.fn().mockResolvedValue({ requirements: [] });
    const prisma = { discoveryConversation: { findUnique: jest.fn() } };
    const controller = new RequirementsController(prisma as never, { extractAndPersist } as never, {} as never, {} as never);

    await controller.extract('mission-2', { rawUserIdea: 'Explicit idea' });

    expect(prisma.discoveryConversation.findUnique).not.toHaveBeenCalled();
    expect(extractAndPersist).toHaveBeenCalledWith('mission-2', 'Explicit idea');
  });
});
