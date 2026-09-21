import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InspectionOutcome } from '@prisma/client';
import { MAX_NOTES_LENGTH } from '../../../common/decorators';
import { CompleteInspectionDto } from './dtos';

// whitelist y forbidNonWhitelisted como el ValidationPipe global (sin la conversion implicita, que estos campos no necesitan).
async function validar(extra: Record<string, unknown>) {
  const dto = plainToInstance(CompleteInspectionDto, {
    inspectedAt: '2026-09-10T11:30:00.000Z',
    outcome: InspectionOutcome.VIOLATION_FOUND,
    ...extra,
  });
  const errores = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return { dto, campos: errores.map((e) => e.property) };
}

describe('CompleteInspectionDto: campos de cierre (#217)', () => {
  it.each([
    ['violationType', 'NOISE_LIMIT'],
    ['violationType', 'ILLEGAL_DUMPING'],
    ['violationType', 'UNTREATED_DISCHARGE'],
    ['violationType', 'HAZARDOUS_WASTE'],
    ['violationType', 'AIR_EMISSION'],
    ['violationType', 'NO_WASTE_MANAGEMENT'],
    ['violationType', 'INSPECTION_OBSTRUCTION'],
    ['severity', 'LOW'],
    ['severity', 'MEDIUM'],
    ['severity', 'HIGH'],
    ['severity', 'CRITICAL'],
    ['suggestedAction', 'WARNING'],
    ['suggestedAction', 'FORMAL_NOTICE'],
    ['suggestedAction', 'FINE'],
    ['suggestedAction', 'CLOSURE'],
  ])('%s acepta %s (el valor que manda el frontend)', async (campo, valor) => {
    expect((await validar({ [campo]: valor })).campos).toEqual([]);
  });

  it.each([
    ['violationType', 'NOISE'],
    ['severity', 'SEVERE'],
    ['suggestedAction', 'SANCTION'],
  ])('%s rechaza %s', async (campo, valor) => {
    expect((await validar({ [campo]: valor })).campos).toEqual([campo]);
  });

  it('conclusion acepta el tope y rechaza tope + 1', async () => {
    expect((await validar({ conclusion: 'a'.repeat(MAX_NOTES_LENGTH) })).campos).toEqual([]);
    expect((await validar({ conclusion: 'a'.repeat(MAX_NOTES_LENGTH + 1) })).campos).toEqual([
      'conclusion',
    ]);
  });

  it('conclusion se recorta y no acepta algo que no sea string', async () => {
    expect((await validar({ conclusion: '  sin vertido  ' })).dto.conclusion).toBe('sin vertido');
    expect((await validar({ conclusion: 42 })).campos).toEqual(['conclusion']);
  });

  it('findings acepta el tope y rechaza tope + 1 (#222)', async () => {
    expect((await validar({ findings: 'a'.repeat(MAX_NOTES_LENGTH) })).campos).toEqual([]);
    expect((await validar({ findings: 'a'.repeat(MAX_NOTES_LENGTH + 1) })).campos).toEqual([
      'findings',
    ]);
  });

  it('findings se recorta y no acepta algo que no sea string (#222)', async () => {
    expect((await validar({ findings: '  vertido al pluvial  ' })).dto.findings).toBe(
      'vertido al pluvial',
    );
    expect((await validar({ findings: 42 })).campos).toEqual(['findings']);
  });

  it('los cuatro son opcionales', async () => {
    expect((await validar({})).campos).toEqual([]);
  });
});
