import { FastifyInstance } from 'fastify';
import { sendProblem } from '../lib/problem';
import { generateChartConfigBodySchema } from '../validators/ai';
import { generateChartConfig } from '../services/aiService';

export async function aiRoutes(app: FastifyInstance) {
  /**
   * POST /api/ai/chart-config
   * Generates a PlotConfig from natural language + data schema via DeepSeek.
   */
  app.post('/ai/chart-config', { preValidation: [app.authenticate] }, async (request, reply) => {
    const parsed = generateChartConfigBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parsed.error.message,
        errors: parsed.error.flatten(),
      });
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return sendProblem(reply, {
        title: 'AI not configured',
        status: 503,
        detail: 'DEEPSEEK_API_KEY is not set on the server',
      });
    }

    try {
      const result = await generateChartConfig(parsed.data);
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI generation failed';
      app.log.error({ err }, 'AI chart-config generation failed');
      return sendProblem(reply, {
        title: 'AI generation error',
        status: 502,
        detail: message,
      });
    }
  });
}
