import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';

// Type for multipart file
interface MultipartFile {
  file: NodeJS.ReadableStream;
  filename: string;
  mimetype: string;
  fields: Record<string, { value: string } | undefined>;
}

// Extend FastifyRequest to include file method from @fastify/multipart
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    file(): Promise<MultipartFile | undefined>;
    user?: { userId: string; email?: string };
  }
}

// Supported file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
];

const ALL_ALLOWED_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
];

// Max file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Upload directory
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (err) {
    // Directory might already exist
  }
}

export async function filesRoutes(app: FastifyInstance) {
  // Ensure upload directory exists on startup
  await ensureUploadDir();

  // Upload file
  app.post(
    '/files/upload',
    {
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: 'No file uploaded',
        });
      }

      // Validate file type
      if (!ALL_ALLOWED_TYPES.includes(data.mimetype)) {
        return reply.code(400).send({
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: `Unsupported file type: ${data.mimetype}. Allowed types: images (jpg, png, webp, gif), videos (mp4, webm), documents (pdf, pptx)`,
        });
      }

      // Get boardId from query or form field
      const boardId = (request.query as any).boardId || data.fields?.boardId?.value;

      if (!boardId) {
        return reply.code(400).send({
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: 'boardId is required',
        });
      }

      // Verify board exists
      const board = await prisma.board.findUnique({
        where: { id: boardId },
      });

      if (!board) {
        return reply.code(404).send({
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: 'Board not found',
        });
      }

      // Generate unique filename
      const fileId = randomUUID();
      const extension = path.extname(data.filename) || getExtensionFromMimeType(data.mimetype);
      const filename = `${fileId}${extension}`;
      const filePath = path.join(UPLOAD_DIR, filename);

      try {
        // Stream file to disk
        const writeStream = fs.createWriteStream(filePath);
        await pipeline(data.file, writeStream);

        // Get file size
        const stats = await fs.promises.stat(filePath);

        // Check file size limit
        if (stats.size > MAX_FILE_SIZE) {
          // Delete file if too large
          await fs.promises.unlink(filePath);
          return reply.code(400).send({
            type: 'about:blank',
            title: 'Bad Request',
            status: 400,
            detail: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          });
        }

        // Save file metadata to database
        const file = await prisma.file.create({
          data: {
            id: fileId,
            boardId,
            filename,
            originalName: data.filename,
            mimeType: data.mimetype,
            size: stats.size,
            path: filename, // Relative path
          },
        });

        return reply.code(201).send({
          id: file.id,
          filename: file.filename,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          url: `/api/files/${file.id}`,
        });
      } catch (err) {
        // Cleanup on error
        try {
          await fs.promises.unlink(filePath);
        } catch {
          // File might not exist
        }
        throw err;
      }
    },
  );

  // Get file metadata
  app.get(
    '/files/:fileId',
    async (request: FastifyRequest<{ Params: { fileId: string } }>, reply: FastifyReply) => {
      const { fileId } = request.params;

      const file = await prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        return reply.code(404).send({
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: 'File not found',
        });
      }

      // Serve file
      const filePath = path.join(UPLOAD_DIR, file.path);

      try {
        await fs.promises.access(filePath, fs.constants.R_OK);
      } catch {
        return reply.code(404).send({
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: 'File not found on disk',
        });
      }

      // Set appropriate headers
      reply.header('Content-Type', file.mimeType);
      reply.header(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(file.originalName)}"`,
      );
      reply.header('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

      const stream = fs.createReadStream(filePath);
      return reply.send(stream);
    },
  );

  // Download file (force download)
  app.get(
    '/files/:fileId/download',
    async (request: FastifyRequest<{ Params: { fileId: string } }>, reply: FastifyReply) => {
      const { fileId } = request.params;

      const file = await prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        return reply.code(404).send({
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: 'File not found',
        });
      }

      const filePath = path.join(UPLOAD_DIR, file.path);

      try {
        await fs.promises.access(filePath, fs.constants.R_OK);
      } catch {
        return reply.code(404).send({
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: 'File not found on disk',
        });
      }

      reply.header('Content-Type', file.mimeType);
      reply.header(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(file.originalName)}"`,
      );

      const stream = fs.createReadStream(filePath);
      return reply.send(stream);
    },
  );

  // Delete file
  app.delete(
    '/files/:fileId',
    {
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest<{ Params: { fileId: string } }>, reply: FastifyReply) => {
      const { fileId } = request.params;

      const file = await prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        return reply.code(404).send({
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: 'File not found',
        });
      }

      // Delete file from disk
      const filePath = path.join(UPLOAD_DIR, file.path);
      try {
        await fs.promises.unlink(filePath);
      } catch {
        // File might not exist on disk
      }

      // Delete from database
      await prisma.file.delete({
        where: { id: fileId },
      });

      return reply.code(204).send();
    },
  );

  // List files for a board
  app.get(
    '/boards/:boardId/files',
    {
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest<{ Params: { boardId: string } }>, reply: FastifyReply) => {
      const { boardId } = request.params;

      const files = await prisma.file.findMany({
        where: { boardId },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({
        files: files.map((file) => ({
          id: file.id,
          filename: file.filename,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          url: `/api/files/${file.id}`,
          createdAt: file.createdAt,
        })),
      });
    },
  );
}

function getExtensionFromMimeType(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  };
  return extensions[mimeType] ?? '';
}

// Helper to determine node type from file
export function getNodeTypeFromMimeType(mimeType: string): 'image' | 'video' | 'document' {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'image';
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return 'video';
  return 'document';
}
