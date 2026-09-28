import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { OutboxService } from './outbox/outbox.service';
import { InboxService } from './inbox/inbox.service';
import { InboxController } from './inbox/inbox.controller';
import { OutboundResponsesConsumer } from './consumers/outbound-responses.consumer';
import { SanctionsConsumer } from './consumers/sanctions.consumer';
import { TicketsConsumer } from './consumers/tickets.consumer';
import { WeatherConsumer } from './consumers/weather.consumer';
import { RabbitMqConsumer } from './consumers/rabbitmq.consumer';
import { OutboxDispatcher } from './outbox/outbox-dispatcher.service';
import { EventPublisher } from './publishers/event-publisher.port';
import { RabbitMqEventPublisher } from './publishers/rabbitmq.publisher';
import { LoggingEventPublisher } from './publishers/logging.publisher';
import { brokerHost, RabbitMqConfig } from './rabbitmq';

/** La config del bus, o `undefined` si no hay `RABBITMQ_URL`. */
function rabbitMq(config: ConfigService): RabbitMqConfig | undefined {
  const rabbit = config.get<Omit<RabbitMqConfig, 'url'> & { url?: string }>('rabbitmq');
  return rabbit?.url ? { ...rabbit, url: rabbit.url } : undefined;
}

export function createEventPublisher(config: ConfigService): EventPublisher {
  const rabbit = rabbitMq(config);
  const logger = new Logger('EventsModule');

  if (!rabbit) {
    logger.warn(
      'RABBITMQ_URL sin configurar: los eventos se encolan en el outbox y se registran en el log, no se publican a ningún bus',
    );
    return new LoggingEventPublisher();
  }

  logger.log(`Publicación de eventos por RabbitMQ: ${brokerHost(rabbit.url)}`);
  return new RabbitMqEventPublisher(rabbit);
}

/** `null` sin `RABBITMQ_URL`: Nest no le corre hooks y no se abre nada. */
export function createRabbitMqConsumer(
  config: ConfigService,
  inbox: InboxService,
): RabbitMqConsumer | null {
  const rabbit = rabbitMq(config);
  return rabbit ? new RabbitMqConsumer(rabbit, inbox) : null;
}

/**
 * Global porque `OutboxService` lo inyecta cualquier módulo de dominio que
 * publique, igual que PrismaModule.
 *
 * El adaptador de publicación y el consumidor del bus se eligen en arranque
 * según haya o no `RABBITMQ_URL`: sin broker configurado la app levanta igual,
 * los eventos quedan en el outbox con su rastro en el log y lo entrante llega
 * solo por `POST /events/inbox`, que es la situación real mientras M9 no
 * exponga el bus.
 */
@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [InboxController],
  providers: [
    OutboxService,
    OutboxDispatcher,
    InboxService,
    // Cada uno registra sus handlers en su onModuleInit.
    OutboundResponsesConsumer,
    SanctionsConsumer,
    TicketsConsumer,
    WeatherConsumer,
    {
      provide: EventPublisher,
      inject: [ConfigService],
      useFactory: createEventPublisher,
    },
    {
      provide: RabbitMqConsumer,
      inject: [ConfigService, InboxService],
      useFactory: createRabbitMqConsumer,
    },
  ],
  exports: [OutboxService, OutboxDispatcher, InboxService],
})
export class EventsModule {}
