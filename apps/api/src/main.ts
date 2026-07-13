import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { ApiExceptionFilter } from './api-exception.filter.js';
import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);
app.enableCors();
app.use(helmet());
app.useGlobalFilters(new ApiExceptionFilter());
await app.listen(Number(process.env.PORT ?? 3000), '127.0.0.1');
