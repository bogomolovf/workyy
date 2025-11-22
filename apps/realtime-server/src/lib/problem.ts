import { FastifyReply } from 'fastify';

export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, unknown>;
}

export function sendProblem(reply: FastifyReply, problem: ProblemDetails) {
  return reply
    .code(problem.status)
    .header('Content-Type', 'application/problem+json')
    .send({
      type: problem.type ?? 'about:blank',
      title: problem.title,
      status: problem.status,
      detail: problem.detail,
      instance: problem.instance,
      errors: problem.errors,
    });
}

