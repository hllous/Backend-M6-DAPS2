import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma, RiskLevel } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { OutboxService } from '../../../events/outbox/outbox.service';
import { AggregateType, EventType } from '../../../events/event-types';
import { treeRiskDetected } from '../../../events/payloads';
import { CreateTreeSurveyDto, QueryTreeSurveysDto, TreeSurveyResponseDto } from './dto';
import { PaginatedResponseDto } from '../../../common/dto';

@Injectable()
export class TreeSurveysService {
  private readonly logger = new Logger(TreeSurveysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async create(treeId: string, dto: CreateTreeSurveyDto): Promise<TreeSurveyResponseDto> {
    const tree = await this.prisma.tree.findUnique({ where: { id: treeId } });
    if (!tree) {
      throw new NotFoundException(`Árbol con id '${treeId}' no encontrado`);
    }

    const survey = await this.prisma.$transaction(async (tx) => {
      const row = await tx.treeSurvey.create({
        data: {
          treeId,
          surveyedAt: new Date(dto.surveyedAt),
          inspectorId: dto.inspectorId ?? null,
          healthStatus: dto.healthStatus,
          riskLevel: dto.riskLevel,
          riskType: dto.riskType ?? null,
          suggestedIntervention: dto.suggestedIntervention ?? null,
          requiresStreetClosure: dto.requiresStreetClosure ?? false,
          requiresPublicWorks: dto.requiresPublicWorks ?? false,
          notes: dto.notes ?? null,
        },
      });

      // Solo HIGH y CRITICAL salen al bus. Con cualquier otro riskLevel el
      // relevamiento se guarda igual pero no se publica nada.
      if (row.riskLevel === RiskLevel.HIGH || row.riskLevel === RiskLevel.CRITICAL) {
        await this.outbox.enqueue(tx, {
          eventType: EventType.TREE_RISK_DETECTED,
          aggregateType: AggregateType.TREE_SURVEY,
          aggregateId: row.id,
          payload: treeRiskDetected(tree, row),
          occurredAt: row.surveyedAt,
        });
      }
      return row;
    });

    this.logger.log(
      `Relevamiento creado para árbol ${treeId}: ${survey.id} (${survey.healthStatus}, riesgo: ${survey.riskLevel})`,
    );
    return this.toResponseDto(survey);
  }

  async findAllByTree(
    treeId: string,
    query: QueryTreeSurveysDto,
  ): Promise<PaginatedResponseDto<TreeSurveyResponseDto>> {
    await this.ensureTreeExists(treeId);

    const where: Prisma.TreeSurveyWhereInput = { treeId };

    if (query.healthStatus) {
      where.healthStatus = query.healthStatus;
    }
    if (query.riskLevel) {
      where.riskLevel = query.riskLevel;
    }

    const [surveys, total] = await Promise.all([
      this.prisma.treeSurvey.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { surveyedAt: 'desc' },
      }),
      this.prisma.treeSurvey.count({ where }),
    ]);

    return new PaginatedResponseDto(
      surveys.map((s) => this.toResponseDto(s)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findOne(treeId: string, surveyId: string): Promise<TreeSurveyResponseDto> {
    await this.ensureTreeExists(treeId);

    const survey = await this.prisma.treeSurvey.findFirst({
      where: { id: surveyId, treeId },
    });

    if (!survey) {
      throw new NotFoundException(
        `Relevamiento con id '${surveyId}' no encontrado para el árbol '${treeId}'`,
      );
    }

    return this.toResponseDto(survey);
  }

  private async ensureTreeExists(treeId: string): Promise<void> {
    const exists = await this.prisma.tree.findUnique({
      where: { id: treeId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Árbol con id '${treeId}' no encontrado`);
    }
  }

  private toResponseDto(survey: any): TreeSurveyResponseDto {
    return {
      id: survey.id,
      treeId: survey.treeId,
      surveyedAt: survey.surveyedAt,
      inspectorId: survey.inspectorId,
      healthStatus: survey.healthStatus,
      riskLevel: survey.riskLevel,
      riskType: survey.riskType,
      suggestedIntervention: survey.suggestedIntervention,
      requiresStreetClosure: survey.requiresStreetClosure,
      requiresPublicWorks: survey.requiresPublicWorks,
      notes: survey.notes,
      createdAt: survey.createdAt,
    };
  }
}
