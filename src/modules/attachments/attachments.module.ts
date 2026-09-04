import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { EVIDENCE_STORAGE } from './storage/evidence-storage.interface';
import { R2EvidenceStorage } from './storage/r2-evidence.storage';

@Module({
  controllers: [AttachmentsController],
  providers: [AttachmentsService, { provide: EVIDENCE_STORAGE, useClass: R2EvidenceStorage }],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
