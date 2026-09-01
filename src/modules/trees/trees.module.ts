import { Module } from '@nestjs/common';
import { TreesController } from './trees.controller';
import { TreesService } from './trees.service';
import { TreeSurveysController } from './surveys/tree-surveys.controller';
import { TreeSurveysService } from './surveys/tree-surveys.service';
import { TreeInterventionsController } from './interventions/tree-interventions.controller';
import { TreeInterventionsService } from './interventions/tree-interventions.service';

@Module({
  controllers: [
    TreesController,
    TreeSurveysController,
    TreeInterventionsController,
  ],
  providers: [
    TreesService,
    TreeSurveysService,
    TreeInterventionsService,
  ],
  exports: [TreesService, TreeSurveysService, TreeInterventionsService],
})
export class TreesModule {}
