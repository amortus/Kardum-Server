"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerChatHandlers = registerChatHandlers;
const constants_1 = require("../../shared/constants");
const chat_service_1 = __importDefault(require("./chat.service"));
const user_repository_1 = __importDefault(require("../users/user.repository"));
const JOINABLE_CHAT_CHANNELS = new Set(['global', 'group', 'trade']);
const CHAT_ROOM_PREFIX = 'channel:';
function getChatRoom(channel) {
    return `${CHAT_ROOM_PREFIX}${channel}`;
}
function registerChatHandlers(io, socket, deps) {
    const senderUserId = socket.userId;
    const senderUsername = socket.user?.username || `user_${senderUserId}`;
    socket.on(constants_1.SOCKET_EVENTS.CHAT_JOIN, async (payload, ack) => {
        try {
            const channel = String(payload?.channel || '').trim().toLowerCase();
            const includeHistory = payload?.includeHistory === true;
            if (!JOINABLE_CHAT_CHANNELS.has(channel) || !chat_service_1.default.isValidChannel(channel)) {
                socket.emit(constants_1.SOCKET_EVENTS.CHAT_ERROR, {
                    code: 'invalid_channel',
                    message: 'Invalid channel'
                });
                ack?.({ ok: false, error: 'invalid_channel' });
                return;
            }
            socket.join(getChatRoom(channel));
            chat_service_1.default.recordJoin(includeHistory);
            let history = [];
            if (includeHistory) {
                history = await chat_service_1.default.getChannelHistory(channel);
                socket.emit(constants_1.SOCKET_EVENTS.CHAT_HISTORY, { channel, messages: history });
            }
            logChatEvent('chat_join', senderUserId, socket.id, channel, 0, 1);
            ack?.({ ok: true, data: { channel, count: history.length } });
        }
        catch (error) {
            socket.emit(constants_1.SOCKET_EVENTS.CHAT_ERROR, {
                code: 'join_failed',
                message: error.message || 'Failed to join channel'
            });
            ack?.({ ok: false, error: 'join_failed' });
        }
    });
    socket.on(constants_1.SOCKET_EVENTS.CHAT_MESSAGE, async (payload, ack) => {
        try {
            const channel = String(payload?.channel || '').trim().toLowerCase();
            const message = String(payload?.message || '');
            chat_service_1.default.recordMessageIngress();
            if (!chat_service_1.default.isValidChannel(channel) || channel === 'whisper') {
                socket.emit(constants_1.SOCKET_EVENTS.CHAT_ERROR, {
                    code: 'invalid_channel',
                    message: 'Invalid channel'
                });
                chat_service_1.default.recordDroppedMessage('invalid_channel', channel, senderUserId);
                ack?.({ ok: false, error: 'invalid_channel' });
                return;
            }
            const validationError = chat_service_1.default.validateMessageInput(senderUserId, channel, message);
            if (validationError) {
                socket.emit(constants_1.SOCKET_EVENTS.CHAT_ERROR, validationError);
                chat_service_1.default.recordDroppedMessage(validationError.code, channel, senderUserId);
                ack?.({ ok: false, error: validationError.code });
                return;
            }
            const chatMessage = chat_service_1.default.createChannelMessage({
                channel,
                senderUserId,
                senderUsername,
                message
            });
            chat_service_1.default.queueForPersistence(chatMessage);
            const roomName = getChatRoom(channel);
            io.to(roomName).emit(constants_1.SOCKET_EVENTS.CHAT_MESSAGE, chatMessage);
            const deliveryCount = io.sockets.adapter.rooms.get(roomName)?.size || 0;
            logChatEvent('chat_message', senderUserId, socket.id, channel, chatMessage.message.length, deliveryCount);
            ack?.({ ok: true, data: chatMessage });
        }
        catch (error) {
            socket.emit(constants_1.SOCKET_EVENTS.CHAT_ERROR, {
                code: 'message_failed',
                message: error.message || 'Could not send message'
            });
            ack?.({ ok: false, error: 'message_failed' });
        }
    });
    socket.on(constants_1.SOCKET_EVENTS.CHAT_WHISPER, async (payload, ack) => {
        try {
            const recipientRaw = String(payload?.recipient || '').trim();
            const message = String(payload?.message || '');
            chat_service_1.default.recordMessageIngress();
            const validationError = chat_service_1.default.validateMessageInput(senderUserId, 'whisper', message);
            if (!recipientRaw) {
                socket.emit(constants_1.SOCKET_EVENTS.CHAT_ERROR, {
                    code: 'invalid_recipient',
                    message: 'Recipient is required'
                });
                chat_service_1.default.recordDroppedMessage('invalid_recipient', 'whisper', senderUserId);
                ack?.({ ok: false, error: 'invalid_recipient' });
                return;
            }
            if (validationError) {
                socket.emit(constants_1.SOCKET_EVENTS.CHAT_ERROR, validationError);
                chat_service_1.default.recordDroppedMessage(validationError.code, 'whisper', senderUserId);
                ack?.({ ok: false, error: validationError.code });
                return;
            }
            const target = await user_repository_1.default.getUserByUsername(recipientRaw);
            if (!target) {
                socket.emit(constants_1.SOCKET_EVENTS.CHAT_ERROR, {
                    code: 'user_not_found',
                    message: 'Recipient not found'
                });
                chat_service_1.default.recordDroppedMessage('user_not_found', 'whisper', senderUserId);
                ack?.({ ok: false, error: 'user_not_found' });
                return;
            }
            const whisper = chat_service_1.default.createWhisperMessage({
                senderUserId,
                senderUsername,
                recipientUserId: target.id,
                recipientUsername: target.username,
                message
            });
            chat_service_1.default.queueForPersistence(whisper);
            const deliveryCount = emitWhisper(io, deps.getUserSocketIds, senderUserId, target.id, whisper);
            logChatEvent('chat_whisper', senderUserId, socket.id, 'whisper', whisper.message.length, deliveryCount);
            ack?.({ ok: true, data: whisper });
        }
        catch (error) {
            socket.emit(constants_1.SOCKET_EVENTS.CHAT_ERROR, {
                code: 'whisper_failed',
                message: error.message || 'Could not send whisper'
            });
            ack?.({ ok: false, error: 'whisper_failed' });
        }
    });
    socket.on(constants_1.SOCKET_EVENTS.CHAT_ZONE_SEND, async (payload) => {
        const zone = String(payload?.zone || 'shadowland').trim().toLowerCase();
        const message = String(payload?.message || '');
        chat_service_1.default.recordMessageIngress();
        const validationError = chat_service_1.default.validateMessageInput(senderUserId, 'zone', message);
        if (validationError) {
            socket.emit(constants_1.SOCKET_EVENTS.CHAT_ERROR, validationError);
            chat_service_1.default.recordDroppedMessage(validationError.code, 'zone', senderUserId);
            return;
        }
        const zoneMessage = chat_service_1.default.createChannelMessage({
            channel: 'zone',
            senderUserId,
            senderUsername,
            message
        });
        chat_service_1.default.queueForPersistence(zoneMessage);
        io.to(`zone:${zone}`).emit(constants_1.SOCKET_EVENTS.CHAT_ZONE_MESSAGE, {
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
function logChatEvent(event, userId, socketId, channel, messageSize, deliveryCount) {
    console.log(JSON.stringify({
        event,
        userId,
        socketId,
        channel,
        channelScope: channel.startsWith('zone:') ? 'zone' : channel,
        messageSize,
        deliveryCount,
        timestamp: Date.now()
    }));
}
function emitWhisper(io, getUserSocketIds, senderUserId, recipientUserId, whisper) {
    const senderSockets = getUserSocketIds(senderUserId);
    const recipientSockets = getUserSocketIds(recipientUserId);
    let delivered = 0;
    for (const sid of senderSockets) {
        io.to(sid).emit(constants_1.SOCKET_EVENTS.CHAT_MESSAGE, whisper);
        delivered += 1;
    }
    for (const sid of recipientSockets) {
        io.to(sid).emit(constants_1.SOCKET_EVENTS.CHAT_MESSAGE, whisper);
        delivered += 1;
    }
    return delivered;
}
//# sourceMappingURL=chat.handlers.js.map