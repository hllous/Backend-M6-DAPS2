# Estándar de documentación Swagger — M6 Ambiente

Este documento define las convenciones que **todo endpoint del backend M6 debe cumplir** para que la documentación Swagger/OpenAPI quede consistente, útil para el equipo interno y consumible por los otros módulos.

Todo endpoint que no cumpla estas reglas no pasa la review de PR.

---

## 1. Configuración global

La configuración de Swagger vive en `src/main.ts` y expone la documentación en `/api/docs`.

```typescript
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('M6 - Ambiente e Higiene API')
    .setDescription(
      'API del módulo 6 de la Municipalidad UADE. Gestiona servicios urbanos, contenedores, arbolado, espacios verdes y control ambiental.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT de usuario emitido por M1 y validado por M6. El contrato de firma, claims y audiencia se configura desde el contrato publicado por M1; M6 no emite JWT propios.',
      },
      'JWT-auth',
    )
    .addTag('services', 'Programación y ejecución de servicios urbanos')
    .addTag('containers', 'Gestión de contenedores')
    .addTag('trees', 'Gestión de arbolado urbano')
    .addTag('green-spaces', 'Espacios verdes')
    .addTag('zones', 'Zonas, recorridos y frecuencias')
    .addTag('environmental-reports', 'Denuncias y expedientes ambientales')
    .addTag('environmental-inspections', 'Inspecciones ambientales')
    .addTag('crews', 'Cuadrillas')
    .addTag('vehicles', 'Vehículos')
    .addTag('citizen-portal', 'Endpoints públicos del portal del ciudadano')
    .addTag('health', 'Health check y estado del servicio')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
```

**URL pública en producción:** `https://m6-backend-m64k.onrender.com/api/docs`

---

## 2. Tags — un tag por dominio

Un endpoint pertenece a **un solo tag**. Los tags deben coincidir exactamente con los definidos en la configuración global:

| Tag | Cubre |
|---|---|
| `services` | Servicios programados, en ejecución, finalizados |
| `containers` | CRUD y operaciones sobre contenedores |
| `trees` | Árboles, podas, extracciones, tratamientos |
| `green-spaces` | Plazas, parques, riego, corte de césped |
| `zones` | Zonas operativas, recorridos, frecuencias |
| `environmental-reports` | Denuncias ambientales, expedientes |
| `environmental-inspections` | Inspecciones programadas y realizadas |
| `crews` | Cuadrillas y su disponibilidad |
| `vehicles` | Vehículos y su estado |
| `citizen-portal` | Endpoints expuestos al ciudadano (portal público) |
| `health` | `/health`, `/ready`, `/metrics` |

**Cómo se aplica:**

```typescript
@ApiTags('containers')
@Controller('containers')
export class ContainersController { }
```

---

## 3. Reglas por endpoint

Todo endpoint debe tener:

- `@ApiOperation` con `summary` (una línea) y `description` (contexto adicional).
- `@ApiResponse` para cada código HTTP que puede devolver.
- DTOs de entrada y salida con `@ApiProperty` en cada campo.
- Si requiere autenticación: `@ApiBearerAuth('JWT-auth')`.
- Si requiere rol específico: mencionarlo en la `description`.

### 3.1 Códigos HTTP obligatorios

Cada tipo de endpoint debe documentar como mínimo:

| Tipo | Códigos obligatorios |
|---|---|
| `GET` (listado) | 200, 401, 500 |
| `GET` (por id) | 200, 401, 404, 500 |
| `POST` | 201, 400, 401, 403, 500 |
| `PUT` / `PATCH` | 200, 400, 401, 403, 404, 500 |
| `DELETE` | 204, 401, 403, 404, 500 |

Además, si aplica reglas de negocio que pueden fallar (por ejemplo intentar iniciar un servicio sin cuadrilla asignada), agregar **409 Conflict** con la descripción.

### 3.2 Ejemplo mínimo aceptable

```typescript
@ApiTags('containers')
@Controller('containers')
@ApiBearerAuth('JWT-auth')
export class ContainersController {
  constructor(private readonly containersService: ContainersService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un contenedor por id',
    description:
      'Retorna el detalle completo de un contenedor incluyendo su zona, estado actual y última inspección.',
  })
  @ApiParam({ name: 'id', description: 'UUID del contenedor' })
  @ApiResponse({
    status: 200,
    description: 'Contenedor encontrado',
    type: ContainerResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token inválido o ausente' })
  @ApiResponse({ status: 404, description: 'Contenedor no encontrado' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async findOne(@Param('id') id: string): Promise<ContainerResponseDto> {
    return this.containersService.findOne(id);
  }
}
```

---

## 4. DTOs — reglas de documentación

### 4.1 Todos los DTOs tienen `@ApiProperty` en cada campo

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsUUID, IsOptional } from 'class-validator';
import { ContainerStatus } from '@prisma/client';

export class CreateContainerDto {
  @ApiProperty({
    description: 'Identificador único de la zona a la que pertenece',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsUUID()
  zoneId: string;

  @ApiProperty({
    description: 'Capacidad del contenedor en litros',
    example: 1100,
    minimum: 1,
  })
  capacity: number;

  @ApiProperty({
    description: 'Estado inicial del contenedor',
    enum: ContainerStatus,
    example: ContainerStatus.ACTIVE,
    default: ContainerStatus.ACTIVE,
  })
  @IsEnum(ContainerStatus)
  @IsOptional()
  status?: ContainerStatus;
}
```

### 4.2 DTOs de respuesta separados de las entidades

**No exponer entidades Prisma directamente en Swagger.** Crear un `*ResponseDto` por cada recurso.

```typescript
export class ContainerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 1100 })
  capacity: number;

  @ApiProperty({ enum: ContainerStatus })
  status: ContainerStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}
```

### 4.3 Campos opcionales

Marcar con `required: false`:

```typescript
@ApiProperty({
  description: 'Notas del inspector',
  example: 'Contenedor con daño superficial en la tapa',
  required: false,
})
@IsOptional()
@IsString()
notes?: string;
```

---

## 5. Formato de respuestas

### 5.1 Éxito

Devolver el recurso o array directamente, sin envolver en `{ data: ... }`.

```json
// GET /containers/:id
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "capacity": 1100,
  "status": "ACTIVE",
  "zoneId": "456e7890-...",
  "createdAt": "2026-08-20T10:00:00.000Z",
  "updatedAt": "2026-08-20T10:00:00.000Z"
}
```

### 5.2 Listados con paginación

```json
{
  "data": [ ... ],
  "meta": {
    "total": 142,
    "page": 1,
    "pageSize": 20,
    "totalPages": 8
  }
}
```

Documentar con un DTO genérico `PaginatedResponseDto<T>`.

### 5.3 Errores

Todos los errores siguen este formato (lo genera el `ExceptionFilter` global):

```json
{
  "statusCode": 404,
  "message": "Container with id 123e4567-... not found",
  "error": "Not Found",
  "timestamp": "2026-08-20T10:00:00.000Z",
  "path": "/containers/123e4567-e89b-12d3-a456-426614174000"
}
```

Definir un DTO `ErrorResponseDto` y reutilizarlo en todos los `@ApiResponse` de error.

---

## 6. Autenticación en Swagger

### 6.0 Origen y validación del JWT

M1 es el emisor del JWT de usuario; M6 actúa exclusivamente como *resource server*: recibe `Authorization: Bearer <token>` y valida firma, expiración, emisor y audiencia según el contrato técnico de M1. No crear tokens alternativos ni asumir un secreto, algoritmo o claims no publicados.

El contrato técnico pendiente de M1 incluye `alg`, `iss`, `aud`, mecanismo de distribución de claves (JWKS/clave pública o equivalente), claims obligatorios y TTL. Hasta recibirlo, la configuración local de desarrollo es temporal y nunca se reutiliza en ambientes compartidos.

Un token de servicio del Core/M9, si se necesitara en una futura comunicación máquina-a-máquina, es distinto del JWT de usuario y no autoriza peticiones de usuarios a esta API.

Endpoints públicos (portal del ciudadano sin login, health check):

```typescript
// Sin @ApiBearerAuth y usualmente sin guard
@Get('public-info')
@ApiOperation({ summary: 'Información pública' })
```

Endpoints autenticados:

```typescript
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Get('me')
```

Endpoints con rol específico — mencionarlo en la descripción:

```typescript
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SERVICE_SUPERVISOR')
@ApiOperation({
  summary: 'Programar un servicio urbano',
  description: 'Requiere rol SERVICE_SUPERVISOR.',
})
@Post()
```

En Swagger UI, el usuario puede pegar su JWT en el botón **Authorize** y probar los endpoints desde ahí.

---

## 7. Convenciones de naming

- **Rutas:** kebab-case en plural. `/environmental-reports`, `/street-closure-requests`.
- **DTOs de entrada:** `Create*Dto`, `Update*Dto`, `Query*Dto`.
- **DTOs de salida:** `*ResponseDto`.
- **Enums en Swagger:** siempre en MAYÚSCULAS (coinciden con el `enum` de Prisma).
- **Endpoints acción sobre recurso:** `POST /services/:id/start`, `POST /services/:id/complete`, no verbos crudos en la URL.

---

## 8. Checklist de revisión de PR

Antes de aprobar un PR que agrega o modifica endpoints, verificar:

- [ ] Cada endpoint tiene `@ApiOperation` con summary y description
- [ ] Todos los códigos HTTP posibles están documentados con `@ApiResponse`
- [ ] Los DTOs de entrada y salida tienen `@ApiProperty` en cada campo
- [ ] El endpoint está bajo el tag correcto
- [ ] Si es autenticado, tiene `@ApiBearerAuth('JWT-auth')`
- [ ] Los ejemplos en `@ApiProperty` son realistas (no `"string"` a secas)
- [ ] Swagger UI carga sin errores en `/api/docs`
- [ ] Se puede probar el endpoint desde Swagger UI con un JWT real

---

## 9. Recursos

- Documentación oficial NestJS Swagger: https://docs.nestjs.com/openapi/introduction
- OpenAPI Specification 3.0: https://swagger.io/specification/
- URL pública de nuestro Swagger: https://m6-backend-m64k.onrender.com/api/docs

---

*Última actualización: sprint 1*
*Responsable: Scrum Master*
