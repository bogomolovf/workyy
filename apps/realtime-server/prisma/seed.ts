import 'dotenv/config';
import { PrismaClient, WorkspaceRole, NodeType, RunStatus, RunTrigger } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.run.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.snapshot.deleteMany();
  await prisma.edge.deleteMany();
  await prisma.node.deleteMany();
  await prisma.board.deleteMany();
  await prisma.retentionPolicy.deleteMany();
  await prisma.secret.deleteMany();
  await prisma.userWorkspaceRole.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      email: 'demo@workyy.dev',
      name: 'Demo User',
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: 'Demo Workspace',
      members: {
        create: {
          userId: user.id,
          role: WorkspaceRole.owner,
        },
      },
    },
  });

  const board = await prisma.board.create({
    data: {
      workspaceId: workspace.id,
      ownerId: user.id,
      title: 'Analytics Exploration',
      description: 'Demo board with SQL and Python nodes',
    },
  });

  const sqlNode = await prisma.node.create({
    data: {
      boardId: board.id,
      type: NodeType.sql,
      positionX: 120,
      positionY: 160,
      payload: {
        sql: 'SELECT * FROM demo_data LIMIT 10;',
      },
    },
  });

  const pythonNode = await prisma.node.create({
    data: {
      boardId: board.id,
      type: NodeType.python,
      positionX: 420,
      positionY: 160,
      payload: {
        python: [
          'import pandas as pd',
          'import plotly.express as px',
          '',
          'if df is None:',
          "    print('⚠️ Run the upstream SQL node first.')",
          '    result = None',
          'else:',
          "    summary = df.groupby('region', as_index=False)['revenue'].sum()",
          '    result = summary',
          "    plot = px.bar(summary, x='region', y='revenue', title='Revenue by region')",
        ].join('\n'),
      },
    },
  });

  await prisma.edge.create({
    data: {
      boardId: board.id,
      sourceId: sqlNode.id,
      targetId: pythonNode.id,
    },
  });

  await prisma.run.createMany({
    data: [
      {
        nodeId: sqlNode.id,
        boardId: board.id,
        status: RunStatus.succeeded,
        trigger: RunTrigger.manual,
        finishedAt: new Date(),
      },
      {
        nodeId: pythonNode.id,
        boardId: board.id,
        status: RunStatus.queued,
        trigger: RunTrigger.upstream,
      },
    ],
  });

  const runs = await prisma.run.findMany({
    where: { boardId: board.id },
  });

  await prisma.runRequest.createMany({
    data: runs.map((run, index) => ({
      boardId: board.id,
      nodeId: run.nodeId,
      idempotencyKey: `seed-${index}`,
      status: 'completed',
      runId: run.id,
      inputs: {},
    })),
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        boardId: board.id,
        workspaceId: workspace.id,
        runId: runs[0]?.id,
        type: 'run.succeeded',
        payload: { trigger: 'manual', message: 'Seed data run completed' },
      },
    ],
  });

  await prisma.comment.create({
    data: {
      boardId: board.id,
      nodeId: sqlNode.id,
      authorId: user.id,
      body: 'Нужно добавить фильтры по регионам перед запуском.',
    },
  });

  await prisma.secret.create({
    data: {
      workspaceId: workspace.id,
      name: 'demo-postgres',
      value: 'ENC[AES256]:postgres://demo:demo@localhost:5432/demo',
    },
  });

  await prisma.retentionPolicy.create({
    data: {
      workspaceId: workspace.id,
      boardId: board.id,
      type: 'run',
      ttlDays: 30,
    },
  });

  console.log('Seed data created successfully');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
