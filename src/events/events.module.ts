import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { OutboxService } from './outbox/outbox.service';
import { OutboxDispatcher } from './outbox/outbox-dispatcher.service';
import { EventPublisher } from './publishers/event-publisher.port';
import { KafkaEventPublisher } from './publishers/kafka.publisher';
import { LoggingEventPublisher } from './publishers/logging.publisher';

/**
 * Global porque `OutboxService` lo inyecta cualquier módulo de dominio que
 * publique, igual que PrismaModule.
 *
 * El adaptador de publicación se elige en arranque según haya o no
 * `KAFKA_BROKERS`: sin broker configurado la app levanta igual y los eventos
 * quedan en el outbox con su rastro en el log, que es la situación real
 * mientras M9 no exponga el bus.
 */
@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    OutboxService,
    OutboxDispatcher,
    {
      provide: EventPublisher,
      inject: [ConfigService],
      useFactory: (config: ConfigService): EventPublisher => {
        const brokers = config.get<string>('kafka.brokers');
        const logger = new Logger('EventsModule');

        if (!brokers) {
          logger.warn(
            'KAFKA_BROKERS sin configurar: los eventos se encolan en el outbox y se registran en el log, no se publican a ningún bus',
          );
          return new LoggingEventPublisher();
        }

        logger.log(`Publicación de eventos por Kafka: ${brokers}`);
        return new KafkaEventPublisher(config);
      },
    },
  ],
  exports: [OutboxService, OutboxDispatcher],
})
export class EventsModule {}
