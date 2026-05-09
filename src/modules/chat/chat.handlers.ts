import type { Server as SocketIOServer, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../shared/constants';
import type { ChatMessage } from '../../shared/types';
import chatService from './chat.service';
import userRepository from '../users/user.repository';

interface AuthedSocket extends Socket {
  userId?: number;
  user?: {
    id: number;
    username: string;
    email?: string;
    isAdmin?: boolean;
  };
}

type AckFn = (payload: { ok: boolean; error?: string; data?: unknown }) => void;
const JOINABLE_CHAT_CHANNELS = new Set(['global', 'group', 'trade']);
const CHAT_ROOM_PREFIX = 'channel:';

function getChatRoom(channel: string): string {
  return `${CHAT_ROOM_PREFIX}${channel}`;
}

export function registerChatHandlers(
  io: SocketIOServer,
  socket: AuthedSocket,
  deps: {
    getUserSocketIds: (userId: number) => string[];
  }
): void {
  const senderUserId = socket.userId!;
  const senderUsername = socket.user?.username || `user_${senderUserId}`;

  socket.on(
    SOCKET_EVENTS.CHAT_JOIN,
    async (payload: { channel?: string; includeHistory?: boolean }, ack?: AckFn) => {
    try {
      const channel = String(payload?.channel || '').trim().toLowerCase();
      const includeHistory = payload?.includeHistory === true;
      if (!JOINABLE_CHAT_CHANNELS.has(channel) || !chatService.isValidChannel(channel)) {
        socket.emit(SOCKET_EVENTS.CHAT_ERROR, {
          code: 'invalid_channel',
          message: 'Invalid channel'
        });
        ack?.({ ok: false, error: 'invalid_channel' });
        return;
      }

      socket.join(getChatRoom(channel));
      chatService.recordJoin(includeHistory);
      let history: ChatMessage[] = [];
      if (includeHistory) {
        history = await chatService.getChannelHistory(channel);
        socket.emit(SOCKET_EVENTS.CHAT_HISTORY, { channel, messages: history });
      }
      logChatEvent('chat_join', senderUserId, socket.id, channel, 0, 1);
      ack?.({ ok: true, data: { channel, count: history.length } });
    } catch (error: any) {
      socket.emit(SOCKET_EVENTS.CHAT_ERROR, {
        code: 'join_failed',
        message: error.message || 'Failed to join channel'
      });
      ack?.({ ok: false, error: 'join_failed' });
    }
  });

  socket.on(
    SOCKET_EVENTS.CHAT_MESSAGE,
    async (payload: { channel?: string; message?: string }, ack?: AckFn) => {
      try {
        const channel = String(payload?.channel || '').trim().toLowerCase();
        const message = String(payload?.message || '');
        chatService.recordMessageIngress();
        if (!chatService.isValidChannel(channel) || channel === 'whisper') {
          socket.emit(SOCKET_EVENTS.CHAT_ERROR, {
            code: 'invalid_channel',
            message: 'Invalid channel'
          });
          chatService.recordDroppedMessage('invalid_channel', channel, senderUserId);
          ack?.({ ok: false, error: 'invalid_channel' });
          return;
        }

        const validationError = chatService.validateMessageInput(senderUserId, channel, message);
        if (validationError) {
          socket.emit(SOCKET_EVENTS.CHAT_ERROR, validationError);
          chatService.recordDroppedMessage(validationError.code, channel, senderUserId);
          ack?.({ ok: false, error: validationError.code });
          return;
        }

        const chatMessage = chatService.createChannelMessage({
          channel,
          senderUserId,
          senderUsername,
          message
        });
        chatService.queueForPersistence(chatMessage);
        const roomName = getChatRoom(channel);
        io.to(roomName).emit(SOCKET_EVENTS.CHAT_MESSAGE, chatMessage);
        const deliveryCount = io.sockets.adapter.rooms.get(roomName)?.size || 0;
        logChatEvent('chat_message', senderUserId, socket.id, channel, chatMessage.message.length, deliveryCount);
        ack?.({ ok: true, data: chatMessage });
      } catch (error: any) {
        socket.emit(SOCKET_EVENTS.CHAT_ERROR, {
          code: 'message_failed',
          message: error.message || 'Could not send message'
        });
        ack?.({ ok: false, error: 'message_failed' });
      }
    }
  );

  socket.on(
    SOCKET_EVENTS.CHAT_WHISPER,
    async (payload: { recipient?: string; message?: string }, ack?: AckFn) => {
      try {
        const recipientRaw = String(payload?.recipient || '').trim();
        const message = String(payload?.message || '');
        chatService.recordMessageIngress();
        const validationError = chatService.validateMessageInput(senderUserId, 'whisper', message);
        if (!recipientRaw) {
          socket.emit(SOCKET_EVENTS.CHAT_ERROR, {
            code: 'invalid_recipient',
            message: 'Recipient is required'
          });
          chatService.recordDroppedMessage('invalid_recipient', 'whisper', senderUserId);
          ack?.({ ok: false, error: 'invalid_recipient' });
          return;
        }
        if (validationError) {
          socket.emit(SOCKET_EVENTS.CHAT_ERROR, validationError);
          chatService.recordDroppedMessage(validationError.code, 'whisper', senderUserId);
          ack?.({ ok: false, error: validationError.code });
          return;
        }

        const target = await userRepository.getUserByUsername(recipientRaw);
        if (!target) {
          socket.emit(SOCKET_EVENTS.CHAT_ERROR, {
            code: 'user_not_found',
            message: 'Recipient not found'
          });
          chatService.recordDroppedMessage('user_not_found', 'whisper', senderUserId);
          ack?.({ ok: false, error: 'user_not_found' });
          return;
        }

        const whisper = chatService.createWhisperMessage({
          senderUserId,
          senderUsername,
          recipientUserId: target.id,
          recipientUsername: target.username,
          message
        });
        chatService.queueForPersistence(whisper);
        const deliveryCount = emitWhisper(io, deps.getUserSocketIds, senderUserId, target.id, whisper);
        logChatEvent('chat_whisper', senderUserId, socket.id, 'whisper', whisper.message.length, deliveryCount);
        ack?.({ ok: true, data: whisper });
      } catch (error: any) {
        socket.emit(SOCKET_EVENTS.CHAT_ERROR, {
          code: 'whisper_failed',
          message: error.message || 'Could not send whisper'
        });
        ack?.({ ok: false, error: 'whisper_failed' });
      }
    }
  );

  socket.on(SOCKET_EVENTS.CHAT_ZONE_SEND, async (payload: { zone?: string; message?: string }) => {
    const zone = String(payload?.zone || 'shadowland').trim().toLowerCase();
    const message = String(payload?.message || '');
    chatService.recordMessageIngress();
    const validationError = chatService.validateMessageInput(senderUserId, 'zone', message);
    if (validationError) {
      socket.emit(SOCKET_EVENTS.CHAT_ERROR, validationError);
      chatService.recordDroppedMessage(validationError.code, 'zone', senderUserId);
      return;
    }
    const zoneMessage = chatService.createChannelMessage({
      channel: 'zone',
      senderUserId,
      senderUsername,
      message
    });
    chatService.queueForPersistence(zoneMessage);
    io.to(`zone:${zone}`).emit(SOCKET_EVENTS.CHAT_ZONE_MESSAGE, {
      zone,
      userId: senderUserId,
      username: senderUsername,
      message: zoneMessage.message,
      sentAt: zoneMessage.timestamp
    });
    const deliveryCount = io.sockets.adapter.rooms.get(`zone:${zone}`)?.size || 0;
    logChatEvent('chat_zone_message', senderUserId, socket.id, `zone:${zone}`, zoneMessage.message.length, deliveryCount);
  });
}

function logChatEvent(
  event: string,
  userId: number,
  socketId: string,
  channel: string,
  messageSize: number,
  deliveryCount: number
): void {
  console.log(
    JSON.stringify({
      event,
      userId,
      socketId,
      channel,
      channelScope: channel.startsWith('zone:') ? 'zone' : channel,
      messageSize,
      deliveryCount,
      timestamp: Date.now()
    })
  );
}

function emitWhisper(
  io: SocketIOServer,
  getUserSocketIds: (userId: number) => string[],
  senderUserId: number,
  recipientUserId: number,
  whisper: ChatMessage
): number {
  const senderSockets = getUserSocketIds(senderUserId);
  const recipientSockets = getUserSocketIds(recipientUserId);
  let delivered = 0;
  for (const sid of senderSockets) {
    io.to(sid).emit(SOCKET_EVENTS.CHAT_MESSAGE, whisper);
    delivered += 1;
  }
  for (const sid of recipientSockets) {
    io.to(sid).emit(SOCKET_EVENTS.CHAT_MESSAGE, whisper);
    delivered += 1;
  }
  return delivered;
}
