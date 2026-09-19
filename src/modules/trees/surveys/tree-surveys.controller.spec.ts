import { TreeSurveysController } from './tree-surveys.controller';
import { TreeSurveysService } from './tree-surveys.service';
import { CreateTreeSurveyDto, QueryTreeSurveysDto } from './dto';

const TREE_ID = '11111111-1111-1111-1111-111111111111';
const SURVEY_ID = '22222222-2222-2222-2222-222222222222';
const RESULT = { id: SURVEY_ID };

describe('TreeSurveysController', () => {
  let service: jest.Mocked<TreeSurveysService>;
  let controller: TreeSurveysController;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(RESULT),
      findAllByTree: jest.fn().mockResolvedValue({ items: [RESULT] }),
      findOne: jest.fn().mockResolvedValue(RESULT),
    } as unknown as jest.Mocked<TreeSurveysService>;
    controller = new TreeSurveysController(service);
  });

  it('create delega treeId y dto', async () => {
    const dto = {} as CreateTreeSurveyDto;
    await expect(controller.create(TREE_ID, dto)).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(TREE_ID, dto);
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
