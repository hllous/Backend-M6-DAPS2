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

**Nadie publica hoy algo que dispare una notificación.** M9 está ausente de la recopilación, así que este evento no tiene publicador confirmado.

Peor: M7 menciona un `notificationRequest` de M2 que ningún otro módulo declaró. **Si resulta que solo M2 puede pedir notificaciones**, estaríamos recibiendo acuses de mensajes que nunca pedimos — en ese caso lo damos de baja y este archivo se borra.

Está pendiente de la respuesta de M9: ver [bloqueantes.md](../../bloqueantes.md#m9--core-).

Su hermano `notificationFailed` no lo consumimos.
