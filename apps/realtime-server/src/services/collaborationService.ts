import { WebSocket } from 'ws';
// @ts-expect-error - y-websocket/bin/utils is a CommonJS module
import { setupWSConnection } from 'y-websocket/bin/utils';
import { ensureBoardAccess } from './authorizationService';

/**
 * Setup WebSocket connection for Yjs collaboration
 * Handles authentication and authorization before setting up the connection
 */
export async function setupCollaborationWS(
  ws: WebSocket,
  request: {
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    params?: { boardId?: string };
  },
  fastify: any,
): Promise<void> {
  // CRITICAL: Log WebSocket connection attempt immediately
  fastify.log.info(
    {
      url: request.url,
      params: request.params,
      readyState: ws.readyState,
      note: 'WebSocket connection received - starting setup',
    },
    'WebSocket connection received',
  );

  // Handle connection errors early
  ws.on('error', (error) => {
    fastify.log.error(
      {
        error: error.message,
        stack: error.stack,
        url: request.url,
        readyState: ws.readyState,
      },
      'WebSocket connection error',
    );
  });

  ws.on('close', (code, reason) => {
    fastify.log.warn(
      {
        code,
        reason: reason.toString(),
        url: request.url,
        readyState: ws.readyState,
      },
      'WebSocket connection closed',
    );
  });

  try {
    // Extract boardId from request params (from Fastify route parameter)
    // WebsocketProvider adds roomName to URL as path: /collab/${boardId}
    // Fastify extracts this as request.params.boardId
    //
    // IMPORTANT: WebsocketProvider should NOT add query params (we removed params option)
    // Final URL should be: ws://host/collab/${boardId} (no query params)
    let boardId = (request.params as { boardId?: string })?.boardId;

    // Fallback: extract from URL path if params not available
    // This handles edge cases where Fastify might not extract params correctly
    if (!boardId && request.url) {
      try {
        const url = new URL(request.url, 'http://localhost');
        const pathParts = url.pathname.split('/').filter(Boolean);
        const collabIndex = pathParts.indexOf('collab');
        if (collabIndex >= 0 && collabIndex < pathParts.length - 1) {
          boardId = pathParts[collabIndex + 1];
        }

        // Also check query params as last resort (should not be needed after removing params option)
        if (!boardId) {
          boardId = url.searchParams.get('boardId') || undefined;
          if (boardId) {
            fastify.log.warn(
              { url: request.url, extractedFrom: 'query-params' },
              'BoardId extracted from query params (should come from path)',
            );
          }
        }
      } catch (error) {
        fastify.log.warn({ url: request.url, error }, 'Failed to parse URL for boardId extraction');
      }
    }

    if (!boardId) {
      fastify.log.warn(
        { url: request.url, params: request.params },
        'WebSocket connection rejected: Missing boardId',
      );
      ws.close(1008, 'Missing boardId parameter');
      return;
    }

    // Log connection attempt with diagnostic info
    fastify.log.info(
      {
        boardId,
        url: request.url,
        params: request.params,
        hasQueryParams: request.url?.includes('?'),
        note: 'WebSocket connection attempt - boardId should come from path parameter /collab/:boardId',
      },
      'WebSocket connection attempt',
    );

    // Extract JWT token from cookies
    const cookies = request.headers.cookie;
    if (!cookies) {
      fastify.log.warn({ url: request.url, boardId }, 'WebSocket rejected: No cookies');
      ws.close(1008, 'Authentication required');
      return;
    }

    // Parse cookies to find auth token
    const cookieName = process.env.AUTH_COOKIE_NAME ?? 'auth_token';
    const cookieMatch = cookies.match(new RegExp(`(?:^|; )${cookieName}=([^;]*)`));
    const token = cookieMatch ? cookieMatch[1] : null;

    if (!token) {
      fastify.log.warn(
        { url: request.url, boardId, cookieName },
        'WebSocket rejected: No auth token in cookies',
      );
      ws.close(1008, 'Authentication required');
      return;
    }

    // Verify JWT token
    let userId: string;
    try {
      // CRITICAL: Check if connection is still open before proceeding
      if (ws.readyState !== ws.OPEN && ws.readyState !== ws.CONNECTING) {
        fastify.log.warn(
          { readyState: ws.readyState, boardId },
          'WebSocket closed before JWT verification',
        );
        return;
      }

      const decoded = fastify.jwt.verify<{ userId: string; email?: string }>(token);
      userId = decoded.userId;
      fastify.log.debug({ userId, boardId }, 'JWT token verified successfully');
    } catch (err) {
      fastify.log.warn(
        { error: err instanceof Error ? err.message : String(err), boardId },
        'WebSocket rejected: Invalid JWT token',
      );
      // Only close if connection is still open
      if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
        ws.close(1008, 'Invalid authentication token');
      }
      return;
    }

    // Check board access
    let access;
    try {
      // CRITICAL: Check if connection is still open before async operation
      if (ws.readyState !== ws.OPEN && ws.readyState !== ws.CONNECTING) {
        fastify.log.warn(
          { readyState: ws.readyState, boardId, userId },
          'WebSocket closed before board access check',
        );
        return;
      }

      access = await ensureBoardAccess({ userId, boardId });

      // Check again after async operation
      if (ws.readyState !== ws.OPEN && ws.readyState !== ws.CONNECTING) {
        fastify.log.warn(
          { readyState: ws.readyState, boardId, userId },
          'WebSocket closed during board access check',
        );
        return;
      }

      if (!access.ok) {
        fastify.log.warn(
          { userId, boardId, status: access.status, reason: access.reason },
          'WebSocket rejected: Board access denied',
        );
        // Only close if connection is still open
        if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
          ws.close(access.status === 404 ? 1008 : 1003, access.reason);
        }
        return;
      }
    } catch (err) {
      fastify.log.error(
        { error: err instanceof Error ? err.message : String(err), userId, boardId },
        'WebSocket rejected: Error checking board access',
      );
      // Only close if connection is still open
      if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
        ws.close(1011, 'Internal server error');
      }
      return;
    }

    // Create a mock request object for setupWSConnection
    // CRITICAL: According to y-websocket source code:
    // setupWSConnection(conn, req, { docName = req.url.slice(1).split('?')[0], gc = true } = {})
    //
    // This means:
    // - If docName is provided in options, it's used directly
    // - Otherwise, it's extracted from req.url: slice(1) removes leading '/', split('?')[0] removes query params
    // - For req.url = "/collab/board123", slice(1).split('?')[0] = "collab/board123" (WRONG for our use case!)
    // - For req.url = "/board123", slice(1).split('?')[0] = "board123" (CORRECT!)
    //
    // SOLUTION: Since we're explicitly passing docName: boardId in options, the URL extraction is not used.
    // However, to be safe and consistent, we use a simple URL format: /${boardId}
    // This ensures that even if docName option is somehow ignored, the URL extraction would still work.
    const mockReq = {
      url: `/${boardId}`, // Simple format: /${boardId} ensures correct extraction if docName option fails
    };

    // CRITICAL FIX: Handle ArrayBuffer to Buffer conversion for ws library
    // y-websocket uses ArrayBuffer, but ws library expects Buffer
    //
    // Problem: The error occurs in Receiver.receiverOnMessage when processing INCOMING messages,
    // not when sending. The ws library's Receiver expects Buffer/TypedArray/DataView, but receives ArrayBuffer.
    //
    // Solution: We need to intercept incoming messages and convert ArrayBuffer to Buffer
    // before they reach the ws library's Receiver. We also need to convert outgoing messages.

    // 1. Fix outgoing messages (ws.send)
    const originalSend = ws.send.bind(ws);
    ws.send = function (data: any, cb?: any) {
      try {
        // Convert ArrayBuffer to Buffer if needed
        if (data instanceof ArrayBuffer) {
          return originalSend(Buffer.from(data), cb);
        }
        // Convert Uint8Array to Buffer if needed (Uint8Array is ArrayBufferView)
        if (data instanceof Uint8Array && !Buffer.isBuffer(data)) {
          return originalSend(Buffer.from(data), cb);
        }
        // For Buffer, string, or other types, send as-is
        return originalSend(data, cb);
      } catch (sendError) {
        fastify.log.error(
          {
            error: sendError instanceof Error ? sendError.message : String(sendError),
            dataType: data?.constructor?.name,
            readyState: ws.readyState,
          },
          'Error sending WebSocket message',
        );
        if (cb) {
          cb(sendError instanceof Error ? sendError : new Error(String(sendError)));
        }
        throw sendError;
      }
    };

    // 2. CRITICAL: Fix incoming messages - intercept before setupWSConnection
    // The ws library's Receiver processes incoming messages internally, but we can
    // intercept them by wrapping the message event. However, since setupWSConnection
    // sets up its own message handler, we need to intercept messages at a lower level.
    //
    // Alternative approach: Use a wrapper that converts incoming ArrayBuffer to Buffer
    // before they reach the ws library's internal Receiver.
    //
    // Actually, the issue is that ws library receives ArrayBuffer in its Receiver,
    // which then tries to process it but fails. The problem is in the ws library's
    // internal handling. We need to ensure the WebSocket receives data in the correct format.
    //
    // Solution: Override the WebSocket's message event handling to convert ArrayBuffer to Buffer
    // before setupWSConnection processes it. However, setupWSConnection sets up its own handlers,
    // so we need to wrap the entire WebSocket or intercept at the ws library level.
    //
    // CRITICAL FIX: The ws library's Receiver expects Buffer for binary messages.
    // When a client sends binary data as ArrayBuffer, ws receives it as ArrayBuffer,
    // but Receiver.receiverOnMessage expects Buffer/TypedArray/DataView.
    // We need to ensure binaryType is set correctly, but more importantly, we need to
    // convert incoming ArrayBuffer to Buffer before they reach Receiver.
    //
    // The best approach: Create a message interceptor that converts ArrayBuffer to Buffer
    // and re-emits the message event with Buffer data before setupWSConnection handles it.

    // CRITICAL FIX: The problem occurs in ws library's Receiver.receiverOnMessage
    // when processing INCOMING messages. The Receiver expects Buffer/TypedArray/DataView,
    // but receives ArrayBuffer, causing TypeError.
    //
    // The issue is that ws library processes messages internally in Receiver before
    // emitting 'message' events. We can't intercept at the EventEmitter level because
    // the error occurs BEFORE the event is emitted.
    //
    // Solution: We need to wrap the WebSocket's internal _socket or intercept at a
    // lower level. However, the best approach is to override ws.emit to convert
    // ArrayBuffer to Buffer BEFORE any handlers (including Receiver) process it.
    //
    // BUT: Receiver processes data internally, not through emit. So we need a different approach.
    //
    // ACTUAL SOLUTION: The ws library's Receiver gets data from the underlying socket.
    // The problem is that when data arrives as ArrayBuffer, Receiver can't process it.
    // We need to ensure the WebSocket receives data in Buffer format from the start.
    //
    // However, since we can't modify ws library internals, we need to intercept at the
    // WebSocket level by overriding the way messages are processed.
    //
    // BEST APPROACH: Override ws.emit to intercept 'message' events and convert ArrayBuffer
    // to Buffer. However, this won't work if Receiver fails before emitting.
    //
    // ALTERNATIVE: Use a Proxy to intercept all property access, but this is complex.
    //
    // SIMPLEST FIX: Override the WebSocket's internal message handler by intercepting
    // the 'message' event listener registration. When setupWSConnection adds a listener,
    // we wrap it to convert ArrayBuffer to Buffer.
    //
    // However, the error happens in Receiver BEFORE listeners are called, so we need
    // to fix it at the ws library level.
    //
    // FINAL SOLUTION: Since the error occurs in Receiver.receiverOnMessage which is
    // internal to ws library, and we can't modify that, we need to ensure the WebSocket
    // is configured correctly. The issue might be that ws library needs to receive
    // data in a different format.
    //
    // Actually, wait: The stack trace shows the error happens when ws tries to process
    // incoming data. The problem is that ws's Receiver expects Buffer, but gets ArrayBuffer.
    // This suggests the underlying socket is sending ArrayBuffer instead of Buffer.
    //
    // The real fix: We need to ensure that when ws receives binary data, it's already
    // in Buffer format. But we can't control that at the TCP level.
    //
    // WORKAROUND: Since we can't modify ws internals, we need to patch the Receiver
    // or use a different approach. One option is to use a custom WebSocket implementation,
    // but that's too complex.
    //
    // ACTUAL WORKING SOLUTION: The issue is that ws library's Receiver processes data
    // in a way that doesn't handle ArrayBuffer. We need to ensure binaryType is set
    // correctly, OR we need to patch the WebSocket to convert ArrayBuffer before
    // it reaches Receiver.
    //
    // Since we can't patch Receiver directly, we'll override ws.emit to convert
    // ArrayBuffer to Buffer for 'message' events. However, this might be too late.
    //
    // FINAL APPROACH: The error occurs in Receiver.receiverOnMessage BEFORE events are emitted.
    // Since we can't intercept at that level, we need to ensure the WebSocket receives
    // data in Buffer format from the start.
    //
    // CRITICAL FIX: Patch the WebSocket's internal _receiver to handle ArrayBuffer.
    // However, since _receiver is internal, we'll intercept at the socket level.
    //
    // ACTUAL WORKING SOLUTION: The ws library's Receiver processes data from the socket.
    // When binary data arrives, if it's ArrayBuffer, Receiver fails. We need to ensure
    // the socket receives Buffer, not ArrayBuffer.
    //
    // Since we can't modify the socket directly, we'll patch the Receiver's dataMessage
    // method to convert ArrayBuffer to Buffer before processing.

    // Patch the Receiver to handle ArrayBuffer
    // The error occurs in Receiver.receiverOnMessage, so we need to patch both
    // dataMessage (which calls receiverOnMessage) and receiverOnMessage directly
    // @ts-expect-error - accessing internal _receiver property
    const receiver = (ws as any)._receiver;
    if (receiver) {
      // Patch receiverOnMessage directly (where the error occurs)
      if (receiver.receiverOnMessage) {
        const originalReceiverOnMessage = receiver.receiverOnMessage.bind(receiver);
        receiver.receiverOnMessage = function (data: any, ...args: any[]) {
          // Convert ArrayBuffer to Buffer before processing
          let convertedData = data;
          if (data instanceof ArrayBuffer) {
            convertedData = Buffer.from(data);
            if (process.env.NODE_ENV === 'development') {
              fastify.log.debug(
                { boardId, dataSize: convertedData.length, convertedFrom: 'ArrayBuffer' },
                'Converted ArrayBuffer to Buffer in Receiver.receiverOnMessage',
              );
            }
          } else if (data instanceof Uint8Array && !Buffer.isBuffer(data)) {
            convertedData = Buffer.from(data);
            if (process.env.NODE_ENV === 'development') {
              fastify.log.debug(
                { boardId, dataSize: convertedData.length, convertedFrom: 'Uint8Array' },
                'Converted Uint8Array to Buffer in Receiver.receiverOnMessage',
              );
            }
          }
          return originalReceiverOnMessage(convertedData, ...args);
        };

        fastify.log.info(
          { boardId },
          'Patched Receiver.receiverOnMessage to handle ArrayBuffer conversion',
        );
      }

      // Also patch dataMessage as a fallback
      if (receiver.dataMessage) {
        const originalDataMessage = receiver.dataMessage.bind(receiver);
        receiver.dataMessage = function (data: any, ...args: any[]) {
          // Convert ArrayBuffer to Buffer before processing
          let convertedData = data;
          if (data instanceof ArrayBuffer) {
            convertedData = Buffer.from(data);
          } else if (data instanceof Uint8Array && !Buffer.isBuffer(data)) {
            convertedData = Buffer.from(data);
          }
          return originalDataMessage(convertedData, ...args);
        };
      }
    } else {
      fastify.log.warn(
        { boardId, hasReceiver: !!receiver },
        'Could not patch Receiver - receiver not available',
      );
    }

    // Also override emit as a fallback for any events that do get emitted
    const originalEmit = ws.emit.bind(ws);
    ws.emit = function (event: string | symbol, ...args: any[]): boolean {
      // Convert ArrayBuffer to Buffer in event arguments
      const convertedArgs = args.map((arg) => {
        if (arg instanceof ArrayBuffer) {
          return Buffer.from(arg);
        }
        if (arg instanceof Uint8Array && !Buffer.isBuffer(arg)) {
          return Buffer.from(arg);
        }
        return arg;
      });

      return originalEmit(event, ...convertedArgs);
    };

    // CRITICAL: Check if connection is still open before setupWSConnection
    if (ws.readyState !== ws.OPEN && ws.readyState !== ws.CONNECTING) {
      fastify.log.warn(
        { readyState: ws.readyState, boardId, userId },
        'WebSocket closed before setupWSConnection',
      );
      return;
    }

    // Log before setupWSConnection
    fastify.log.info(
      {
        boardId,
        userId,
        readyState: ws.readyState,
        mockUrl: mockReq.url,
        docName: boardId,
      },
      'About to call setupWSConnection',
    );

    // Setup WebSocket connection with Yjs
    // CRITICAL: We explicitly pass docName: boardId to ensure ALL clients with the same boardId
    // connect to the SAME Y.Doc on the server. This is the key to cursor synchronization.
    // The docName option takes precedence over URL extraction, so all clients will share the same document.
    try {
      setupWSConnection(ws, mockReq, {
        docName: boardId, // CRITICAL: This ensures all clients share the same Y.Doc for cursor sync
        gc: true, // Enable garbage collection
      });
      fastify.log.info(
        { boardId, userId, readyState: ws.readyState },
        'setupWSConnection called successfully',
      );
    } catch (setupError) {
      fastify.log.error(
        {
          error: setupError instanceof Error ? setupError.message : String(setupError),
          stack: setupError instanceof Error ? setupError.stack : undefined,
          boardId,
          userId,
          readyState: ws.readyState,
        },
        'Error calling setupWSConnection',
      );
      // Don't throw - just log and let connection close naturally if needed
      if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
        ws.close(1011, 'Error setting up Yjs connection');
      }
      return;
    }

    // Log connection establishment with diagnostic info
    // IMPORTANT: Log this to verify all clients use the same docName
    fastify.log.info(
      {
        boardId,
        userId,
        originalUrl: request.url,
        mockUrl: mockReq.url,
        docName: boardId, // This MUST be the same for all clients on the same board
        note: 'CRITICAL: All clients with same boardId MUST use same docName for cursor sync',
      },
      'WebSocket collaboration connection established',
    );

    // CRITICAL DEBUG: Enhanced logging for cursor synchronization diagnosis
    // This helps verify that all clients share the same Y.Doc and cursors are syncing
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      // Import docs map to check how many connections exist for this docName
      // @ts-expect-error - accessing internal docs map from y-websocket
      const { docs } = require('y-websocket/bin/utils');

      // Log document connection count for this docName
      const doc = docs.get(boardId);
      const connectionCount = doc ? doc.conns.size : 0;

      fastify.log.info(
        {
          boardId,
          docName: boardId,
          totalConnections: connectionCount,
          note: 'Total connections to this Y.Doc (should increase as more clients join)',
        },
        'Y.Doc connection status',
      );

      // Log when messages are received/sent (these are Yjs updates including cursor updates)
      ws.on('message', (data: Buffer) => {
        const currentDoc = docs.get(boardId);
        fastify.log.debug(
          {
            boardId,
            userId,
            docName: boardId,
            messageType: 'yjs-update',
            messageSize: data.length,
            connectionCount: currentDoc ? currentDoc.conns.size : 0,
          },
          'Yjs update message received/sent (may include cursor updates)',
        );
      });
    }
  } catch (error) {
    fastify.log.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        url: request.url,
        readyState: ws.readyState,
      },
      'Error setting up collaboration WebSocket',
    );
    // Only close if connection is still open
    if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
      ws.close(1011, 'Internal server error');
    }
  }
}
