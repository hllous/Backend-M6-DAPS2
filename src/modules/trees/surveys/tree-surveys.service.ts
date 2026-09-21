import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma, RiskLevel } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { OutboxService } from '../../../events/outbox/outbox.service';
import { AggregateType, EventType } from '../../../events/event-types';
import { treeRiskDetected } from '../../../events/payloads';
import { CreateTreeSurveyDto, QueryTreeSurveysDto, TreeSurveyResponseDto } from './dto';
import { PaginatedResponseDto } from '../../../common/dto';
import { todayArgentina } from '../../../common/utils/date-only';

@Injectable()
export class TreeSurveysService {
  private readonly logger = new Logger(TreeSurveysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async create(treeId: string, dto: CreateTreeSurveyDto): Promise<TreeSurveyResponseDto> {
    // Se compara por día en Argentina, no por instante: el frontend manda el mediodía UTC
    // del día de hoy y antes de las 09:00 locales ese instante todavía es futuro.
    // Un relevamiento de día futuro pasaría a ser el `lastSurvey` y taparía a los reales.
    if (todayArgentina(new Date(dto.surveyedAt)).getTime() > todayArgentina().getTime()) {
      throw new BadRequestException(
        `'surveyedAt' (${dto.surveyedAt}) no puede ser posterior a hoy (huso Argentina)`,
      );
    }
    // treeRiskDetected exige riskType; validarlo acá evita guardar el relevamiento
    // y después publicar un evento que viola su schema.
    if (this.publicaEvento(dto.riskLevel) && !dto.riskType) {
      throw new BadRequestException(
        `Un relevamiento con riesgo ${dto.riskLevel} necesita 'riskType'`,
      );
    }
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
      if (this.publicaEvento(row.riskLevel)) {
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

  private publicaEvento(riskLevel: RiskLevel): boolean {
    return riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL;
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
