import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Prisma connected');
      console.log('✅ Prisma connected');
    } catch (error) {
      this.logger.error('❌ Prisma connection failed', error);
      console.error('❌ Prisma connection failed', error);
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Prisma disconnected');
      console.log('Prisma disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting Prisma', error);
      console.error('Error disconnecting Prisma', error);
    }
  }
}