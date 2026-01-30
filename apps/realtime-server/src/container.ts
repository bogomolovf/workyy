import { prisma } from './lib/prisma';
import { AuditService } from './services/auditService';
import { ClickhouseService } from './services/clickhouseService';
import { DependencyResolver } from './services/dependencyResolver';
import { MysqlService } from './services/mysqlService';
import { OracleService } from './services/oracleService';
import { PostgresService } from './services/postgresService';
import { RunService } from './services/runService';
import { SqlServerService } from './services/sqlserverService';
import { RunProcessor } from './workers/runProcessor';

const dependencyResolver = new DependencyResolver(prisma);
const auditService = new AuditService(prisma);
const postgresService = new PostgresService(prisma);
const mysqlService = new MysqlService(prisma);
const oracleService = new OracleService(prisma);
const sqlserverService = new SqlServerService(prisma);
const clickhouseService = new ClickhouseService(prisma);
const runService = new RunService(prisma, dependencyResolver, auditService);
const runProcessor = new RunProcessor(runService);

export const container = {
  prisma,
  dependencyResolver,
  auditService,
  postgresService,
  mysqlService,
  oracleService,
  sqlserverService,
  clickhouseService,
  runService,
  runProcessor,
};
