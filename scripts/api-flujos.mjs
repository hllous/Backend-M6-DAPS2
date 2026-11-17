// Flujos encadenados de la colección Postman (#697): cada uno crea su propio recurso, lo recorre
// por la máquina de estados y guarda los ids en variables de colección para el paso siguiente.
// Los consume scripts/build-postman-collection.mjs; con ellos cada operación del OpenAPI tiene un
// caso de éxito (2xx con aserciones sobre el cuerpo) además de los de error que se generan solos.
//
// Un paso: { op, nombre, como, path, body, headers, esperado, guardar, chequeos, pre }
//   op        operación del OpenAPI a la que cuenta ("METHOD /ruta/{param}").
//   como      token: 'token' (admin, por omisión), 'campoToken', 'inspectorToken', 'auditorToken', null (público).
//   path      ruta real; puede llevar {{variables}} de la colección.
//   esperado  status esperado (2xx = caso de éxito; 4xx = caso de error del flujo).
//   guardar   { variable: 'expresión JS sobre j (el cuerpo)' } -> variable de colección.
//   chequeos  [['descripción', 'código con pm.expect(...)']] sobre j (cuerpo) y r (respuesta).
//   pre       líneas JS que corren antes del request.

const p = (op, nombre, extra = {}) => ({ op, nombre, ...extra });
const run = `pm.collectionVariables.get('run')`;

/** Código único por corrida: `{{run}}` lo fija el primer paso. */
const c = (prefijo) => `${prefijo}{{run}}`;

export function flujos() {
  const pasos = [];
  const add = (...s) => pasos.push(...s);

  // ───────────── 0. Preparación ─────────────
  add(
    p('GET /health', 'arranque de la corrida', {
      como: null,
      path: '/health',
      esperado: 200,
      pre: [
        `pm.collectionVariables.set('ticketPublico', pm.variables.replaceIn('{{$guid}}'));`,
        `pm.collectionVariables.set('run', Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 36).toString(36));`,
      ],
      chequeos: [['status ok', `pm.expect(j.status).to.eql('ok')`]],
    }),
    // El usuario de Campo de la colección: el seed no trae token de Campo, así que se le asignan
    // los roles por la API (como lo hace un M6_ADMIN). Su token se firma en make-token.mjs.
    p('PUT /role-assignments/{userId}', 'asigna Campo e inspector', {
      path: '/role-assignments/29001',
      body: { roles: ['M6_CAMPO_CUADRILLA', 'M6_CAMPO_INSPECTOR'] },
      esperado: 200,
      chequeos: [
        ['quedan los dos roles', `pm.expect(j.roles).to.have.members(['M6_CAMPO_CUADRILLA', 'M6_CAMPO_INSPECTOR'])`],
      ],
    }),
  );

  // ───────────── 1. Catálogos ─────────────
  add(
    p('POST /zones', 'alta de zona', {
      path: '/zones',
      body: { code: c('ZF'), name: 'Zona de flujo {{run}}' },
      esperado: 201,
      guardar: { zoneId: 'j.id' },
      chequeos: [['devuelve la zona creada', `pm.expect(j).to.include({ code: 'ZF' + ${run}, active: true })`]],
    }),
    p('POST /zones', 'alta de segunda zona', {
      path: '/zones',
      body: { code: c('ZG'), name: 'Zona G {{run}}' },
      esperado: 201,
      guardar: { zoneId2: 'j.id' },
    }),
    p('PATCH /zones/{id}', 'renombra la zona', {
      path: '/zones/{{zoneId}}',
      body: { name: 'Zona renombrada {{run}}' },
      esperado: 200,
      chequeos: [['el nombre cambió', `pm.expect(j.name).to.eql('Zona renombrada ' + ${run})`]],
    }),
    p('POST /zones/{id}/neighborhoods', 'asigna un barrio del catálogo', {
      path: '/zones/{{zoneId}}/neighborhoods',
      pre: [
        `const base = pm.variables.get('baseUrl');`,
        `await new Promise((res) => pm.sendRequest({ url: base + '/neighborhoods', header: { Authorization: 'Bearer ' + pm.variables.get('token') } }, (e, r) => { pm.collectionVariables.set('barrioId', r.json()[0].id); res(); }));`,
      ],
      body: { neighborhoodIds: ['{{barrioId}}'] },
      esperado: 201,
      chequeos: [['la zona lista el barrio', `pm.expect(JSON.stringify(j)).to.include(pm.collectionVariables.get('barrioId'))`]],
    }),
    p('DELETE /zones/{id}/neighborhoods/{neighborhoodId}', 'quita el barrio', {
      path: '/zones/{{zoneId}}/neighborhoods/{{barrioId}}',
      esperado: 204,
      chequeos: [['sin cuerpo', `pm.expect(r.text()).to.eql('')`]],
    }),
    p('POST /service-types', 'alta de tipo de servicio', {
      path: '/service-types',
      body: { code: c('TS'), name: 'Tipo {{run}}', category: 'WASTE_COLLECTION', mode: 'ROUTE' },
      esperado: 201,
      guardar: { tipoId: 'j.id' },
      chequeos: [['categoría y modo', `pm.expect(j).to.include({ category: 'WASTE_COLLECTION', mode: 'ROUTE', active: true })`]],
    }),
    p('PATCH /service-types/{id}', 'pide vehículo', {
      path: '/service-types/{{tipoId}}',
      body: { requiresVehicle: true },
      esperado: 200,
      chequeos: [['requiresVehicle true', `pm.expect(j.requiresVehicle).to.eql(true)`]],
    }),
    p('POST /disposal-sites', 'alta de sitio de disposición', {
      path: '/disposal-sites',
      body: { code: c('DS'), name: 'Sitio {{run}}', siteType: 'TRANSFER_STATION' },
      esperado: 201,
      guardar: { sitioId: 'j.id' },
      chequeos: [['tipo de sitio', `pm.expect(j.siteType).to.eql('TRANSFER_STATION')`]],
    }),
    p('PATCH /disposal-sites/{id}', 'cambia el tipo', {
      path: '/disposal-sites/{{sitioId}}',
      body: { siteType: 'RECYCLING_PLANT' },
      esperado: 200,
      chequeos: [['tipo cambiado', `pm.expect(j.siteType).to.eql('RECYCLING_PLANT')`]],
    }),
    p('POST /routes', 'alta de recorrido', {
      path: '/routes',
      body: { code: c('RT'), name: 'Recorrido {{run}}' },
      esperado: 201,
      guardar: { rutaId: 'j.id' },
    }),
    p('PUT /routes/{id}/stops', 'define las paradas', {
      path: '/routes/{{rutaId}}/stops',
      body: {
        stops: [
          { zoneId: '{{zoneId}}', estimatedDurationMin: 45 },
          { zoneId: '{{zoneId2}}', estimatedDurationMin: 30 },
        ],
      },
      esperado: 200,
      chequeos: [
        [
          'dos paradas en orden',
          `pm.expect(j.stops.map((s) => s.zoneId)).to.eql([pm.collectionVariables.get('zoneId'), pm.collectionVariables.get('zoneId2')])`,
        ],
      ],
    }),
    p('PATCH /routes/{id}', 'renombra el recorrido', {
      path: '/routes/{{rutaId}}',
      body: { name: 'Recorrido bis {{run}}' },
      esperado: 200,
      chequeos: [['nombre', `pm.expect(j.name).to.eql('Recorrido bis ' + ${run})`]],
    }),
    p('POST /service-frequencies', 'alta de frecuencia', {
      path: '/service-frequencies',
      body: { serviceTypeId: '{{tipoId}}', routeId: '{{rutaId}}', weekdays: [1, 3, 5], shift: 'MORNING', validFrom: '2026-01-01' },
      esperado: 201,
      guardar: { frecuenciaId: 'j.id' },
      chequeos: [['días y turno', `pm.expect(j).to.deep.include({ weekdays: [1, 3, 5], shift: 'MORNING' })`]],
    }),
    p('PATCH /service-frequencies/{id}', 'pasa al turno tarde', {
      path: '/service-frequencies/{{frecuenciaId}}',
      body: { shift: 'AFTERNOON' },
      esperado: 200,
      chequeos: [['turno', `pm.expect(j.shift).to.eql('AFTERNOON')`]],
    }),
    p('DELETE /service-frequencies/{id}', 'baja de la frecuencia', {
      path: '/service-frequencies/{{frecuenciaId}}',
      esperado: 204,
    }),
    p('POST /vehicles', 'alta de vehículo', {
      path: '/vehicles',
      body: { plate: 'F{{run}}', vehicleType: 'COMPACTOR_TRUCK', capacity: 12 },
      esperado: 201,
      guardar: { vehiculoId: 'j.id' },
      chequeos: [['tipo', `pm.expect(j.vehicleType).to.eql('COMPACTOR_TRUCK')`]],
    }),
    p('PATCH /vehicles/{id}', 'cambia la capacidad', {
      path: '/vehicles/{{vehiculoId}}',
      body: { capacity: 15 },
      esperado: 200,
      chequeos: [['capacidad', `pm.expect(Number(j.capacity)).to.eql(15)`]],
    }),
    p('POST /crews', 'alta de cuadrilla', {
      path: '/crews',
      body: {
        name: 'Cuadrilla de flujo {{run}}',
        crewType: 'MUNICIPAL',
        defaultShift: 'MORNING',
        specialty: 'COLLECTION',
        leaderUserId: '29001',
      },
      esperado: 201,
      guardar: { cuadrillaId: 'j.id' },
      chequeos: [['líder', `pm.expect(j.leaderUserId).to.eql('29001')`]],
    }),
    p('PATCH /crews/{id}', 'cambia el turno', {
      path: '/crews/{{cuadrillaId}}',
      body: { defaultShift: 'AFTERNOON' },
      esperado: 200,
      chequeos: [['turno', `pm.expect(j.defaultShift).to.eql('AFTERNOON')`]],
    }),
    p('POST /crews/{id}/members', 'suma integrantes', {
      path: '/crews/{{cuadrillaId}}/members',
      body: { userIds: ['29001', '29002'] },
      esperado: 201,
      chequeos: [['el integrante figura en la cuadrilla', `pm.expect(JSON.stringify(j)).to.include('29002')`]],
    }),
    p('DELETE /crews/{id}/members/{userId}', 'quita un integrante', {
      path: '/crews/{{cuadrillaId}}/members/29002',
      esperado: 204,
    }),
    p('POST /crews/{id}/zone-assignments', 'asigna zona temporal', {
      path: '/crews/{{cuadrillaId}}/zone-assignments',
      body: { zoneId: '{{zoneId}}', validFrom: '2026-12-01', reason: 'Refuerzo de la zona en la corrida de pruebas' },
      esperado: 201,
      chequeos: [['zona asignada', `pm.expect(j.zoneId).to.eql(pm.collectionVariables.get('zoneId'))`]],
    }),
  );

  // ───────────── 2. Inventario: contenedores, arbolado, espacios verdes ─────────────
  const contenedor = (n, prefijo) =>
    p('POST /containers', `alta del contenedor ${n}`, {
      path: '/containers',
      body: { code: c(prefijo), containerType: 'HOUSEHOLD', zoneId: '{{zoneId}}', capacityLiters: 1100, address: 'Av. Siempre Viva 742' },
      esperado: 201,
      guardar: { [`contenedor${n}`]: 'j.id' },
      chequeos: [['nace ACTIVE', `pm.expect(j.status).to.eql('ACTIVE')`]],
    });
  const accion = (n, op, ruta, nombre, estado, extra = {}) =>
    p(op, nombre, {
      path: `/containers/{{contenedor${n}}}/${ruta}`,
      esperado: 200,
      chequeos: [['estado resultante', `pm.expect(j.status).to.eql('${estado}')`]],
      ...extra,
    });
  add(
    // A: desborde y vaciado
    contenedor('A', 'CA'),
    p('PATCH /containers/{id}', 'cambia la capacidad', {
      path: '/containers/{{contenedorA}}',
      body: { capacityLiters: 2200 },
      esperado: 200,
      chequeos: [['capacidad', `pm.expect(j.capacityLiters).to.eql(2200)`]],
    }),
    accion('A', 'POST /containers/{id}/report-overflow', 'report-overflow', 'Campo informa el desborde', 'OVERFLOWED', { como: 'campoToken' }),
    accion('A', 'POST /containers/{id}/empty', 'empty', 'Campo lo vacía', 'ACTIVE', { como: 'campoToken' }),
    // B: daño, reparación
    contenedor('B', 'CB'),
    accion('B', 'POST /containers/{id}/report-damage', 'report-damage', 'Campo informa el daño', 'DAMAGED', {
      como: 'campoToken',
      body: { damageType: 'LID_BROKEN', severity: 'MEDIUM', requiresPublicWorks: false, observations: 'Tapa rota' },
    }),
    accion('B', 'POST /containers/{id}/start-repair', 'start-repair', 'Operaciones inicia la reparación', 'UNDER_REPAIR'),
    accion('B', 'POST /containers/{id}/complete-repair', 'complete-repair', 'termina la reparación', 'ACTIVE'),
    // C: reubicación
    contenedor('C', 'CC'),
    accion('C', 'POST /containers/{id}/relocate', 'relocate', 'pide reubicar', 'RELOCATING'),
    accion('C', 'POST /containers/{id}/confirm-relocation', 'confirm-relocation', 'confirma la nueva ubicación', 'ACTIVE', {
      body: { address: 'Av. Santa Fe 2800', lat: -34.5955, lng: -58.4016 },
    }),
    // D: baja
    contenedor('D', 'CD'),
    accion('D', 'POST /containers/{id}/report-damage', 'report-damage', 'daño severo', 'DAMAGED', {
      como: 'campoToken',
      body: { damageType: 'STRUCTURAL', severity: 'CRITICAL', requiresPublicWorks: false },
    }),
    accion('D', 'POST /containers/{id}/remove', 'remove', 'se retira del inventario', 'REMOVED'),

    p('POST /trees', 'alta de árbol', {
      path: '/trees',
      body: { surveyCode: c('AR'), zoneId: '{{zoneId}}', species: 'Jacarandá', address: 'Av. Corrientes 1000', heightM: 8.5, diameterCm: 40 },
      esperado: 201,
      guardar: { arbolId: 'j.id' },
      chequeos: [['especie', `pm.expect(j.species).to.eql('Jacarandá')`]],
    }),
    p('PATCH /trees/{id}', 'corrige la altura', {
      path: '/trees/{{arbolId}}',
      body: { heightM: 9.25 },
      esperado: 200,
      chequeos: [['altura', `pm.expect(Number(j.heightM)).to.eql(9.25)`]],
    }),
    p('POST /trees/{treeId}/surveys', 'Campo releva el árbol', {
      como: 'campoToken',
      path: '/trees/{{arbolId}}/surveys',
      body: { surveyedAt: '2026-11-10T12:00:00.000Z', healthStatus: 'WEAKENED', riskLevel: 'HIGH', riskType: 'FALLING_BRANCH', suggestedIntervention: 'SAFETY_PRUNING', notes: 'Rama colgante' },
      esperado: 201,
      guardar: { relevamientoId: 'j.id' },
      chequeos: [['estado de salud y riesgo', `pm.expect(j).to.include({ healthStatus: 'WEAKENED', riskLevel: 'HIGH' })`]],
    }),
    p('POST /trees', 'alta de árbol a dar de baja', {
      path: '/trees',
      body: { surveyCode: c('AS'), zoneId: '{{zoneId}}' },
      esperado: 201,
      guardar: { arbolBajaId: 'j.id' },
    }),
    p('DELETE /trees/{id}', 'baja lógica del árbol', { path: '/trees/{{arbolBajaId}}', esperado: 204 }),

    p('POST /green-spaces', 'alta de espacio verde', {
      path: '/green-spaces',
      body: { name: 'Plaza {{run}}', spaceType: 'SQUARE', zoneId: '{{zoneId}}', areaM2: 1500 },
      esperado: 201,
      guardar: { espacioId: 'j.id' },
      chequeos: [['tipo', `pm.expect(j.spaceType).to.eql('SQUARE')`]],
    }),
    p('PATCH /green-spaces/{id}', 'cambia el área', {
      path: '/green-spaces/{{espacioId}}',
      body: { areaM2: 1800 },
      esperado: 200,
      chequeos: [['área', `pm.expect(Number(j.areaM2)).to.eql(1800)`]],
    }),
    p('DELETE /green-spaces/{id}', 'baja del espacio verde', { path: '/green-spaces/{{espacioId}}', esperado: 204 }),
    p('POST /green-points', 'alta de punto verde', {
      path: '/green-points',
      body: { code: c('PV'), name: 'Punto verde {{run}}', zoneId: '{{zoneId}}', wasteTypes: ['RECYCLABLE', 'GREEN'] },
      esperado: 201,
      guardar: { puntoId: 'j.id' },
      chequeos: [['residuos', `pm.expect(j.wasteTypes).to.have.members(['RECYCLABLE', 'GREEN'])`]],
    }),
    p('PATCH /green-points/{id}', 'agrega un tipo de residuo', {
      path: '/green-points/{{puntoId}}',
      body: { wasteTypes: ['RECYCLABLE', 'GREEN', 'BULKY'] },
      esperado: 200,
      chequeos: [['tres tipos', `pm.expect(j.wasteTypes).to.have.length(3)`]],
    }),
    p('DELETE /green-points/{id}', 'baja del punto verde', { path: '/green-points/{{puntoId}}', esperado: 204 }),
  );

  // ───────────── 3. Servicios ─────────────
  const servicio = (n, extra = {}) =>
    p('POST /services', `programa el servicio ${n}`, {
      path: '/services',
      body: { serviceTypeId: '{{tipoId}}', routeId: '{{rutaId}}', scheduledDate: '{{fecha}}', origin: 'PLANNED', ...extra },
      esperado: 201,
      guardar: { [`servicio${n}`]: 'j.id' },
      chequeos: [['nace SCHEDULED', `pm.expect(j.status).to.eql('SCHEDULED')`]],
    });
  const trans = (n, ruta, nombre, estado, extra = {}) =>
    p(`POST /services/{id}/${ruta}`, nombre, {
      path: `/services/{{servicio${n}}}/${ruta}`,
      esperado: 200,
      chequeos: [['estado resultante', `pm.expect(j.status).to.eql('${estado}')`]],
      ...extra,
    });
  add(
    p('GET /health', 'fecha de los servicios', {
      como: null,
      path: '/health',
      esperado: 200,
      chequeos: [['servicio activo', `pm.expect(j.status).to.eql('ok')`]],
      pre: [`pm.collectionVariables.set('fecha', new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10));`],
    }),
    servicio('A'),
    p('PATCH /services/{id}', 'asigna vehículo y ventana', {
      path: '/services/{{servicioA}}',
      body: { vehicleId: '{{vehiculoId}}', windowFrom: '08:00', windowTo: '12:00', notes: 'Servicio de la colección' },
      esperado: 200,
      chequeos: [['vehículo y notas', `pm.expect(j).to.include({ vehicleId: pm.collectionVariables.get('vehiculoId'), notes: 'Servicio de la colección' })`]],
    }),
    trans('A', 'assign-crew', 'asigna la cuadrilla', 'SCHEDULED', {
      body: { crewId: '{{cuadrillaId}}' },
      chequeos: [['cuadrilla', `pm.expect(j.crewId).to.eql(pm.collectionVariables.get('cuadrillaId'))`]],
    }),
    trans('A', 'start', 'Campo inicia', 'IN_PROGRESS', { como: 'campoToken' }),
    p('POST /services/{id}/delay-notices', 'Campo avisa una demora', {
      como: 'campoToken',
      path: '/services/{{servicioA}}/delay-notices',
      body: { delayType: 'DURATION', delayMinutes: 30, reason: 'Tránsito pesado' },
      esperado: 201,
      chequeos: [['demora', `pm.expect(j).to.include({ delayType: 'DURATION', delayMinutes: 30 })`]],
    }),
    trans('A', 'suspend', 'Campo suspende', 'SUSPENDED', { como: 'campoToken', body: { reason: 'Lluvia intensa' } }),
    trans('A', 'resume', 'Campo retoma', 'IN_PROGRESS', { como: 'campoToken' }),
    p('POST /services/{id}/zone-results', 'Campo informa la zona atendida', {
      como: 'campoToken',
      path: '/services/{{servicioA}}/zone-results',
      body: { zoneId: '{{zoneId}}', status: 'SERVICED' },
      esperado: 201,
      guardar: { resultadoZonaId: 'j.id' },
      chequeos: [['estado de la zona', `pm.expect(j.status).to.eql('SERVICED')`]],
    }),
    p('POST /services/{id}/collection-records', 'Campo registra la recolección', {
      como: 'campoToken',
      path: '/services/{{servicioA}}/collection-records',
      body: { wasteType: 'HOUSEHOLD', disposalSiteId: '{{sitioId}}', zoneResultId: '{{resultadoZonaId}}', weightKg: 1250.5, volumeM3: 8 },
      esperado: 201,
      chequeos: [['tipo de residuo', `pm.expect(j.wasteType).to.eql('HOUSEHOLD')`]],
    }),
    p('POST /services/{id}/zone-results', 'Campo informa la segunda zona, parcial', {
      como: 'campoToken',
      path: '/services/{{servicioA}}/zone-results',
      body: { zoneId: '{{zoneId2}}', status: 'PARTIAL', reason: 'WEATHER', notes: 'Lluvia' },
      esperado: 201,
      chequeos: [['estado de la zona', `pm.expect(j.status).to.eql('PARTIAL')`]],
    }),
    trans('A', 'complete', 'Campo cierra el servicio', 'PARTIALLY_COMPLETED', { como: 'campoToken' }),
    servicio('B'),
    trans('B', 'cancel', 'cancela', 'CANCELLED', { body: { reason: 'Se suspende la campaña' } }),
    servicio('C'),
    trans('C', 'reschedule', 'pide reprogramar', 'RESCHEDULED', { body: { reason: 'Camión averiado' } }),
    trans('C', 'confirm-reschedule', 'confirma la nueva fecha', 'SCHEDULED', {
      body: { scheduledDate: '{{fechaNueva}}', windowFrom: '09:00', windowTo: '11:00' },
      pre: [`pm.collectionVariables.set('fechaNueva', new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10));`],
    }),
  );

  // ───────────── 4. Arbolado: intervenciones ─────────────
  const intervencion = (n, tipo) =>
    p('POST /tree-interventions', `solicita la intervención ${n}`, {
      path: '/tree-interventions',
      body: { interventionType: tipo, treeIds: ['{{arbolId}}'], priority: 'HIGH', justification: 'Riesgo de caída de ramas' },
      esperado: 201,
      guardar: { [`intervencion${n}`]: 'j.id' },
      chequeos: [['trae estado', `pm.expect(j.status).to.be.a('string')`]],
    });
  const intTrans = (n, ruta, nombre, estado, extra = {}) =>
    p(`POST /tree-interventions/{id}/${ruta}`, nombre, {
      path: `/tree-interventions/{{intervencion${n}}}/${ruta}`,
      esperado: 200,
      chequeos: [['estado resultante', `pm.expect(j.status).to.eql('${estado}')`]],
      ...extra,
    });
  add(
    intervencion('A', 'REMOVAL'),
    intTrans('A', 'submit-for-authorization', 'pide autorización', 'PENDING_AUTHORIZATION'),
    intTrans('A', 'authorize', 'M6_ADMIN autoriza', 'AUTHORIZED', { body: { justification: 'Autorizada por riesgo' } }),
    p('POST /service-types', 'tipo puntual de arbolado', {
      path: '/service-types',
      body: { code: c('TA'), name: 'Poda {{run}}', category: 'TREES', mode: 'POINT' },
      esperado: 201,
      guardar: { tipoPuntualId: 'j.id' },
    }),
    p('POST /services', 'programa la poda sobre el árbol', {
      path: '/services',
      body: { serviceTypeId: '{{tipoPuntualId}}', scheduledDate: '{{fecha}}', origin: 'MANUAL', targetType: 'TREE', targetId: '{{arbolId}}', zoneId: '{{zoneId}}' },
      esperado: 201,
      guardar: { servicioPuntualId: 'j.id' },
    }),
    intTrans('A', 'assign-service', 'asocia el servicio', 'AUTHORIZED', { body: { serviceId: '{{servicioPuntualId}}' } }),
    intervencion('B', 'REMOVAL'),
    intTrans('B', 'submit-for-authorization', 'pide autorización', 'PENDING_AUTHORIZATION'),
    intTrans('B', 'reject', 'se rechaza', 'REJECTED'),
  );

  // ───────────── 5. Ambiente: expedientes e inspecciones ─────────────
  const expediente = (n, tipo, extra = {}) =>
    p('POST /environmental-reports', `alta del expediente ${n}`, {
      path: '/environmental-reports',
      body: { reportType: tipo, address: 'Camino de Cintura 4500', description: 'Denuncia de la colección', priority: 'MEDIUM', ...extra },
      esperado: 201,
      guardar: { [`expediente${n}`]: 'j.id' },
      chequeos: [['nace RECEIVED', `pm.expect(j.status).to.eql('RECEIVED')`]],
    });
  const expTrans = (n, ruta, nombre, estado, extra = {}) =>
    p(`POST /environmental-reports/{id}/${ruta}`, nombre, {
      path: `/environmental-reports/{{expediente${n}}}/${ruta}`,
      esperado: 200,
      chequeos: [['estado resultante', `pm.expect(j.status).to.eql('${estado}')`]],
      ...extra,
    });
  add(
    expediente('A', 'WATER_DISCHARGE'),
    expTrans('A', 'start-review', 'pasa a análisis', 'UNDER_REVIEW'),
    p('POST /environmental-reports/{reportId}/inspections', 'programa la inspección', {
      path: '/environmental-reports/{{expedienteA}}/inspections',
      body: { inspectorId: '29001' },
      esperado: 201,
      guardar: { inspeccionId: 'j.id' },
      chequeos: [['inspector asignado', `pm.expect(j.inspectorId).to.eql('29001')`]],
    }),
    p('GET /environmental-inspections/{id}', 'detalle de la inspección', {
      path: '/environmental-inspections/{{inspeccionId}}',
      esperado: 200,
      chequeos: [['es la inspección creada', `pm.expect(j.id).to.eql(pm.collectionVariables.get('inspeccionId'))`]],
    }),
    p('POST /environmental-inspections/{id}/complete', 'el inspector cierra con infracción', {
      como: 'campoToken',
      path: '/environmental-inspections/{{inspeccionId}}/complete',
      body: {
        inspectedAt: '2026-11-10T12:00:00.000Z',
        outcome: 'VIOLATION_FOUND',
        nextStep: 'NOTICE_TO_BE_ISSUED',
        findings: 'Vertido sin tratar',
        checklist: [{ itemCode: 'RES-01', label: 'Plan de gestión vigente', result: false }],
        violationType: 'UNTREATED_DISCHARGE',
        severity: 'HIGH',
        suggestedAction: 'FINE',
      },
      esperado: 200,
      chequeos: [['resultado', `pm.expect(j.outcome).to.eql('VIOLATION_FOUND')`]],
    }),
    p('POST /environmental-inspections/{id}/violation-notice', 'se emite el acta', {
      path: '/environmental-inspections/{{inspeccionId}}/violation-notice',
      body: { violationType: 'UNTREATED_DISCHARGE', severity: 'HIGH', suggestedAction: 'FINE' },
      esperado: 201,
      chequeos: [['tipo de infracción', `pm.expect(j.violationType).to.eql('UNTREATED_DISCHARGE')`]],
    }),
    p('GET /environmental-inspections/{id}/violation-notice', 'lee el acta', {
      path: '/environmental-inspections/{{inspeccionId}}/violation-notice',
      esperado: 200,
      chequeos: [['gravedad', `pm.expect(j.severity).to.eql('HIGH')`]],
    }),
    expTrans('A', 'close', 'cierra el expediente', 'CLOSED'),
    expediente('B', 'NOISE'),
    expTrans('B', 'start-review', 'pasa a análisis', 'UNDER_REVIEW'),
    expTrans('B', 'forward', 'deriva a otra área', 'FORWARDED', { body: { reason: 'Corresponde a Habilitaciones' } }),
    expediente('C', 'ODOR'),
    expTrans('C', 'start-review', 'pasa a análisis', 'UNDER_REVIEW'),
    expTrans('C', 'dismiss', 'se desestima', 'DISMISSED', { body: { reason: 'Sin sustento' } }),
    expediente('D', 'OTHER', { ticketId: '{{ticketPublico}}' }),
    expTrans('D', 'start-review', 'pasa a análisis', 'UNDER_REVIEW'),
    p('GET /public/reports/{ticketId}', 'el vecino consulta su denuncia sin token', {
      como: null,
      path: '/public/reports/{{ticketPublico}}',
      esperado: 200,
      chequeos: [['es el reclamo consultado', `pm.expect(j.ticketId).to.eql(pm.collectionVariables.get('ticketPublico'))`]],
    }),
    p('GET /evidence', 'lista la evidencia de un servicio (vacía)', {
      path: '/evidence',
      query: { ownerType: 'SERVICE', ownerId: '{{servicioA}}' },
      esperado: 200,
      chequeos: [['sin adjuntos', `pm.expect(Array.isArray(j) ? j : j.data).to.have.length(0)`]],
    }),
    expTrans('D', 'request-information', 'pide información', 'UNDER_REVIEW', { body: { message: 'Indique la dirección exacta' } }),
  );

  // ───────────── 6. Obras: reparaciones y cortes de calle ─────────────
  add(
    p('POST /repair-requests', 'pedido de reparación desde un servicio', {
      path: '/repair-requests',
      body: { damageType: 'BROKEN_PAVEMENT', severity: 'HIGH', publicSafetyRisk: true, detectedInType: 'SERVICE', detectedInId: '{{servicioA}}', address: 'Av. Rivadavia 5000' },
      esperado: 201,
      guardar: { reparacionId: 'j.id' },
      chequeos: [['trae estado', `pm.expect(j.status).to.be.a('string')`]],
    }),
    p('POST /repair-requests/{id}/start', 'se inicia la obra', {
      path: '/repair-requests/{{reparacionId}}/start',
      body: { workOrderId: 'OT-{{run}}' },
      esperado: 200,
      chequeos: [['en curso', `pm.expect(j.status).to.eql('IN_PROGRESS')`]],
    }),
    p('POST /repair-requests/{id}/close', 'se cierra la obra', {
      path: '/repair-requests/{{reparacionId}}/close',
      esperado: 200,
      chequeos: [['cerrada', `pm.expect(j.status).to.eql('CLOSED')`]],
    }),
  );
  const corte = (n) =>
    p('POST /street-closure-requests', `pide el corte ${n}`, {
      path: '/street-closure-requests',
      body: {
        sourceType: 'SERVICE',
        sourceId: '{{servicioB}}',
        reason: 'Trabajo sobre la calzada',
        sections: [{ streetName: 'Belgrano', fromCross: 'Mitre', toCross: 'San Martín', direction: 'BOTH' }],
        requestedFrom: '2026-12-01T10:00:00.000Z',
        requestedTo: '2026-12-01T18:00:00.000Z',
        closureType: 'PARTIAL',
      },
      esperado: 201,
      guardar: { [`corte${n}`]: 'j.id' },
    });
  add(
    corte('A'),
    p('POST /street-closure-requests/{id}/approve', 'se aprueba', { path: '/street-closure-requests/{{corteA}}/approve', body: { closureId: 'CL-{{run}}' }, esperado: 200, chequeos: [['aprobado', `pm.expect(j.status).to.eql('APPROVED')`]] }),
    p('POST /street-closure-requests/{id}/end', 'se da por terminado', { path: '/street-closure-requests/{{corteA}}/end', esperado: 200, chequeos: [['terminado', `pm.expect(j.status).to.eql('ENDED')`]] }),
    corte('B'),
    p('POST /street-closure-requests/{id}/reject', 'se rechaza', { path: '/street-closure-requests/{{corteB}}/reject', body: { reason: 'Calle de alto tránsito' }, esperado: 200, chequeos: [['rechazado', `pm.expect(j.status).to.eql('REJECTED')`]] }),
  );

  // ───────────── 7. Eventos y roles ─────────────
  add(
    p('POST /events/inbox', 'evento sin handler se registra y se ignora', {
      path: '/events/inbox',
      body: { eventId: 'ev-flujo-{{run}}', eventType: 'eventoDeLaColeccion', eventVersion: '1.0', occurredAt: '2026-11-10T12:00:00.000Z', sourceModule: 'M0', data: {} },
      esperado: 200,
      chequeos: [['ignorado', `pm.expect(j.status).to.eql('ignored')`]],
    }),
    p('POST /events/outbox/{id}/retry', 'reencola un evento fallido', {
      path: '/events/outbox/{{outboxFallidoId}}/retry',
      pre: [
        `const base = pm.variables.get('baseUrl');`,
        `await new Promise((res) => pm.sendRequest({ url: base + '/events/outbox?status=FAILED&pageSize=1', header: { Authorization: 'Bearer ' + pm.variables.get('token') } }, (e, r) => { pm.variables.set('outboxFallidoId', r.json().data[0].id); res(); }));`,
      ],
      esperado: 200,
      chequeos: [['vuelve a PENDING', `pm.expect(j.status).to.eql('PENDING')`]],
    }),
    p('POST /events/outbox/retry-failed', 'reencola los fallidos', {
      path: '/events/outbox/retry-failed',
      body: { confirm: true, limit: 10 },
      esperado: 200,
      chequeos: [['informa cuántos reencoló y cuántos quedan', `pm.expect(j.requeued).to.be.a('number'); pm.expect(j.remainingFailed).to.eql(0)`]],
    }),
    p('PUT /role-assignments/{userId}', 'asigna un rol de Operaciones', { path: '/role-assignments/29003', body: { roles: ['M6_OFICINA_OPERACIONES'] }, esperado: 200, chequeos: [['queda el rol', `pm.expect(j.roles).to.eql(['M6_OFICINA_OPERACIONES'])`]] }),
    p('DELETE /role-assignments/{userId}', 'quita los roles', { path: '/role-assignments/29003', esperado: 204 }),
  );

  // ───────────── 8. Bajas de los catálogos creados ─────────────
  add(
    p('DELETE /routes/{id}', 'baja del recorrido', { path: '/routes/{{rutaId}}', esperado: 204 }),
    p('DELETE /disposal-sites/{id}', 'baja del sitio', { path: '/disposal-sites/{{sitioId}}', esperado: 204 }),
    p('DELETE /service-types/{id}', 'baja del tipo', { path: '/service-types/{{tipoId}}', esperado: 204 }),
    p('DELETE /vehicles/{id}', 'baja del vehículo', { path: '/vehicles/{{vehiculoId}}', esperado: 204 }),
    p('DELETE /crews/{id}', 'baja de la cuadrilla', { path: '/crews/{{cuadrillaId}}', esperado: 204 }),
    p('DELETE /zones/{id}', 'baja de la zona', { path: '/zones/{{zoneId}}', esperado: 204 }),
  );

  return pasos;
}
