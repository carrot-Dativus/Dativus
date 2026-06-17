package com.dativus.server.websocket;

import com.dativus.server.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
@RequiredArgsConstructor
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private final JwtUtil jwtUtil;

    // workspaceId → 연결된 세션 목록
    private final Map<String, List<WebSocketSession>> rooms = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String token = extractToken(session);
        if (token == null || !jwtUtil.validateToken(token)) {
            session.close(CloseStatus.NOT_ACCEPTABLE);
            return;
        }
        String workspaceId = extractWorkspaceId(session);
        rooms.computeIfAbsent(workspaceId, k -> new CopyOnWriteArrayList<>()).add(session);
        System.out.println("[WS] 연결: " + workspaceId + " (총 " + rooms.get(workspaceId).size() + "명)");
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String workspaceId = extractWorkspaceId(session);
        List<WebSocketSession> sessions = rooms.get(workspaceId);
        if (sessions != null) {
            sessions.remove(session);
            System.out.println("[WS] 연결 종료: " + workspaceId + " (남은 " + sessions.size() + "명)");
        }
    }

    public void broadcast(String workspaceId, String json) {
        List<WebSocketSession> sessions = rooms.getOrDefault(workspaceId, List.of());
        for (WebSocketSession s : sessions) {
            if (s.isOpen()) {
                try { s.sendMessage(new TextMessage(json)); }
                catch (IOException ignored) {}
            }
        }
    }

    private String extractWorkspaceId(WebSocketSession session) {
        String path = session.getUri().getPath(); // /ws/chat/{workspaceId}
        return path.substring(path.lastIndexOf('/') + 1);
    }

    private String extractToken(WebSocketSession session) {
        String query = session.getUri().getQuery(); // token=xxx
        if (query == null) return null;
        for (String param : query.split("&")) {
            if (param.startsWith("token=")) return param.substring(6);
        }
        return null;
    }
}
