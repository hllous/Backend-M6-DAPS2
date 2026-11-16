import { TreeSurveysController } from './tree-surveys.controller';
import { TreeSurveysService } from './tree-surveys.service';
import { CreateTreeSurveyDto, QueryTreeSurveysDto } from './dto';
import type { Mocked } from 'vitest';

const TREE_ID = '11111111-1111-1111-1111-111111111111';
const SURVEY_ID = '22222222-2222-2222-2222-222222222222';
const RESULT = { id: SURVEY_ID };

describe('TreeSurveysController', () => {
  let service: Mocked<TreeSurveysService>;
  let controller: TreeSurveysController;

  beforeEach(() => {
    service = {
      create: vi.fn().mockResolvedValue(RESULT),
      findAllByTree: vi.fn().mockResolvedValue({ items: [RESULT] }),
      findOne: vi.fn().mockResolvedValue(RESULT),
    } as unknown as Mocked<TreeSurveysService>;
    controller = new TreeSurveysController(service);
  });

  it('create delega treeId y dto', async () => {
    const dto = {} as CreateTreeSurveyDto;
    await expect(controller.create(TREE_ID, dto, 'user-7')).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(TREE_ID, dto, 'user-7');
  });

  it('findAll delega treeId y query', async () => {
    const query = {} as QueryTreeSurveysDto;
    await controller.findAll(TREE_ID, query);
    expect(service.findAllByTree).toHaveBeenCalledWith(TREE_ID, query);
  });

  it('findOne delega treeId y surveyId', async () => {
    await controller.findOne(TREE_ID, SURVEY_ID);
    expect(service.findOne).toHaveBeenCalledWith(TREE_ID, SURVEY_ID);
  });
});
