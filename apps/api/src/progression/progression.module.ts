import { Module } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';
import { PrismaProgressionRepository } from './prisma-progression.repository.js';
import { ProgressionController } from './progression.controller.js';
import { ProgressionRepository } from './progression.repository.js';
import { ProgressionService } from './progression.service.js';

@Module({
  controllers: [ProgressionController],
  providers: [
    PrismaService,
    ProgressionService,
    { provide: ProgressionRepository, useClass: PrismaProgressionRepository },
  ],
})
export class ProgressionModule {}
