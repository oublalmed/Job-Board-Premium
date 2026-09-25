import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity.js';
import { AuditService } from './audit.service.js';
import { AuditAdminController } from './audit-admin.controller.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditAdminController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
