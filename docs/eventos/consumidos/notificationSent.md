# `notificationSent` ← M9

Acuse de que una notificación al vecino se envió.

## Qué hace M6 al recibirlo

Registra el acuse. No dispara ninguna transición de estado.

## Campos imprescindibles

| Campo | Nota |
|---|---|
| `notificationId` | Su identificador |
| `channel` | Por dónde salió |
| `sentAt` | Cuándo |
| `sourceRef` | **Referencia al evento que la originó.** Sin esto el acuse no se puede atribuir a nada |

## 🔴 Puede que lo saquemos

**Nadie publica hoy algo que dispare una notificación.** M9 está ausente de la recopilación, así que este evento sigue sin publicador confirmado (pregunta abierta en #258).

Peor: M7 menciona un `notificationRequest` de M2 que ningún otro módulo declaró. **Si resulta que solo M2 puede pedir notificaciones**, estaríamos recibiendo acuses de mensajes que nunca pedimos — en ese caso lo damos de baja y este archivo se borra.

**Actualización 20/10.** M9 respondió que `notificationSent` **no existe en su catálogo**: ningún módulo lo declara ni lo escucha, nunca llegó uno. Pero el TPO pone las notificaciones a cargo del Core (§9) y lista `NotificacionEnviada` / `NotificacionFallida` entre los eventos que consumen varios módulos, el nuestro incluido (§6). Por eso **no se saca todavía**: se lleva a M9 y, si hace falta, a la cátedra (#300). Hasta entonces sigue sin handler, porque nadie lo emite. Ver [bloqueantes.md](../../integracion/m9.md#m9--core-).

Su hermano `notificationFailed` no lo consumimos.
