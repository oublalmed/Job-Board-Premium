import { Module } from '@nestjs/common';
import { SharedRedisConnectionService } from './shared-redis-connection.service.js';

@Module({
  providers: [SharedRedisConnectionService],
  exports: [SharedRedisConnectionService],
})
export class RedisConnectionModule {}
