import { prisma } from './lib/prisma';
import { DependencyResolver } from './services/dependencyResolver';
import { AuditService } from './services/auditService';
import { RunService } from './services/runService';
import { RunProcessor } from './workers/runProcessor';
import { PostgresService } from './services/postgresService';

const dependencyResolver = new DependencyResolver(prisma);
const auditService = new AuditService(prisma);
const postgresService = new PostgresService(prisma);
const runService = new RunService(prisma, dependencyResolver, auditService);
const runProcessor = new RunProcessor(runService);

export const container = {
  prisma,
  dependencyResolver,
  auditService,
  postgresService,
  runService,
  runProcessor,
};

