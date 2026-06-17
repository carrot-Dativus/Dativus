package com.dativus.server.service;

import com.dativus.server.entity.*;
import com.dativus.server.repository.*;
import com.dativus.server.websocket.ChatWebSocketHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final ChatSessionRepository chatSessionRepository;
    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final FeedbackLogRepository feedbackLogRepository;
    private final ChatWebSocketHandler chatWebSocketHandler;
    private final ObjectMapper objectMapper;

    // 1-a. 세션 명시적 생성 (새 채널 or 개인 채팅)
    @Transactional
    public ChatSession createSession(String workspaceIdStr, String title, String sessionType, String userIdStr, String channelMode) {
        UUID workspaceId = UUID.fromString(workspaceIdStr);
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new RuntimeException("워크스페이스를 찾을 수 없습니다."));
        ChatSession session = new ChatSession();
        session.setWorkspace(workspace);
        session.setTitle(title);
        session.setSessionType(sessionType != null ? sessionType : "TEAM_CHANNEL");
        session.setChannelMode(channelMode != null ? channelMode : "AI");
        if (userIdStr != null && !userIdStr.isEmpty()) {
            session.setUserId(UUID.fromString(userIdStr));
        }
        return chatSessionRepository.save(session);
    }

    // 1-b. 세션 목록 조회 (사이드바용) — 레거시 null 세션 자동 마이그레이션 포함
    @Transactional
    public Map<String, Object> listSessions(String workspaceIdStr, String userIdStr) {
        UUID workspaceId = UUID.fromString(workspaceIdStr);

        // null 타입 레거시 세션 처리: 가장 오래된 것 하나만 TEAM_CHANNEL로 마이그레이션
        // (React StrictMode 동시 호출로 생긴 중복 세션 제거)
        List<ChatSession> nullSessions = chatSessionRepository.findNullTypeSessions(workspaceId);
        if (!nullSessions.isEmpty()) {
            ChatSession primary = nullSessions.get(0); // createdAt ASC → 가장 오래된 것
            primary.setSessionType("TEAM_CHANNEL");
            if ("기본 채팅방".equals(primary.getTitle())) primary.setTitle("일반");
            chatSessionRepository.save(primary);
            // 나머지 중복 세션은 DB에 남기되 목록에 노출하지 않음 (데이터 보전)
        }

        List<ChatSession> teamChannels = chatSessionRepository.findTeamChannelsByWorkspaceId(workspaceId);
        List<ChatSession> personalChats = new java.util.ArrayList<>();
        if (userIdStr != null && !userIdStr.isEmpty()) {
            UUID userId = UUID.fromString(userIdStr);
            personalChats = chatSessionRepository.findPersonalChatsByWorkspaceIdAndUserId(workspaceId, userId);
            // 개인 AI 채팅이 하나도 없으면 기본 세션 자동 생성
            if (personalChats.isEmpty()) {
                Workspace workspace = workspaceRepository.findById(workspaceId)
                        .orElseThrow(() -> new RuntimeException("워크스페이스를 찾을 수 없습니다."));
                ChatSession defaultPersonal = new ChatSession();
                defaultPersonal.setWorkspace(workspace);
                defaultPersonal.setTitle("개인 AI 채팅");
                defaultPersonal.setSessionType("PERSONAL");
                defaultPersonal.setUserId(userId);
                chatSessionRepository.save(defaultPersonal);
                personalChats = chatSessionRepository.findPersonalChatsByWorkspaceIdAndUserId(workspaceId, userId);
            }
        }
        Map<String, Object> result = new HashMap<>();
        result.put("teamChannels", teamChannels.stream().map(s -> Map.of(
                "id", s.getId().toString(),
                "title", s.getTitle(),
                "channelMode", s.getChannelMode() != null ? s.getChannelMode() : "AI"
        )).toList());
        result.put("personalChats", personalChats.stream().map(s -> Map.of(
                "id", s.getId().toString(),
                "title", s.getTitle(),
                "channelMode", s.getChannelMode() != null ? s.getChannelMode() : "AI"
        )).toList());
        return result;
    }

    // 1-c. 방 만들기 (또는 기존 방 찾기) — 기존 호환성 유지
    @Transactional
    public ChatSession getOrCreateSession(String workspaceIdStr, String title) {
        UUID workspaceId = UUID.fromString(workspaceIdStr);
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new RuntimeException("워크스페이스를 찾을 수 없습니다."));

        // 1. 해당 워크스페이스에 이미 생성된 세션이 있는지 확인합니다.
        List<ChatSession> existingSessions = chatSessionRepository.findByWorkspaceIdOrderByCreatedAtDesc(workspaceId);

        // 2. 이미 사용하던 방이 있다면, 가장 최근 방을 반환하여 대화를 이어가게 합니다.
        if (existingSessions != null && !existingSessions.isEmpty()) {
            return existingSessions.get(0);
        }

        ChatSession newSession = new ChatSession();
        newSession.setWorkspace(workspace);
        newSession.setTitle(title);
        return chatSessionRepository.save(newSession);
    }

    // 2. 메시지 저장 (비밀 여부 포함)
    @Transactional
    public void saveMessage(String sessionIdStr, String userIdStr, String senderType, String senderName, String content, Boolean isPrivate, Double latency, Integer tokens, Integer messageOrder) {
        ChatSession session = chatSessionRepository.findById(UUID.fromString(sessionIdStr))
                .orElseThrow(() -> new RuntimeException("채팅방을 찾을 수 없습니다."));

        User user = null;
        if (userIdStr != null && !userIdStr.isEmpty()) {
            user = userRepository.findById(UUID.fromString(userIdStr)).orElse(null);
        }

        ChatMessage message = new ChatMessage();
        message.setSession(session);
        message.setUser(user);
        message.setSenderType(senderType);
        message.setSenderName(senderName);
        message.setContent(content);
        message.setPrivate(isPrivate != null ? isPrivate : false);
        message.setLatency(latency != null ? latency : 0.0);
        message.setTokens(tokens != null ? tokens : 0);
        message.setMessageOrder(messageOrder != null ? messageOrder : 0);

        chatMessageRepository.save(message);

        // 팀 탭 실시간 동기화: 공개 메시지만 WebSocket으로 broadcast
        if (!message.isPrivate() && session.getWorkspace() != null) {
            try {
                Map<String, Object> payload = new HashMap<>();
                boolean isAgent = senderName != null && senderName.startsWith("AGENT:");
                if ("USER".equals(senderType)) {
                    payload.put("sender", "user");
                } else if (isAgent) {
                    payload.put("sender", "custom_agent");
                    payload.put("agentName", senderName.substring(6));
                } else {
                    payload.put("sender", "ai");
                }
                payload.put("text", content);
                payload.put("sessionId", session.getId().toString());
                payload.put("senderName", senderName != null ? senderName : "");
                payload.put("sourceUserId", userIdStr != null ? userIdStr : "");
                chatWebSocketHandler.broadcast(
                        session.getWorkspace().getId().toString(),
                        objectMapper.writeValueAsString(payload)
                );
            } catch (Exception ignored) {}
        }

        // =========================================================
        // 작전 5: AI 자동 실패 감지 룰 엔진 (Rule-Engine)
        // =========================================================
        if ("LOCAL_AI".equals(senderType)) {
            boolean isAutoFail = false;
            String failReason = "";

            // 룰 1: 작전 수행 시간이 30초를 초과한 경우
            if (latency != null && latency > 30.0) {
                isAutoFail = true;
                failReason = "응답 지연 초과 (" + latency + "초)";
            }
            // 룰 2: 환각(Hallucination) 및 회피 키워드 감지
            else if (content.contains("잘 모르겠습니다") ||
                    content.contains("알 수 없습니다") ||
                    content.contains("정보가 없습니다")) {
                isAutoFail = true;
                failReason = "환각/회피성 키워드 감지";
            }

            // 감지기에 걸렸다면 강제로 오답 노트(FeedbackLog) 적재!
            if (isAutoFail) {
                FeedbackLog autoFeedback = new FeedbackLog();

                autoFeedback.setUserId(userIdStr);

                // 💡 1. Session 객체에서 Workspace ID를 꺼내와서 세팅 (Entity 구조 일치)
                if (session.getWorkspace() != null) {
                    autoFeedback.setWorkspaceId(session.getWorkspace().getId().toString());
                }

                // 💡 2. 필수 값(query, answer) 세팅
                // - query(질문) 칸에는 관리자가 보기 편하게 [자동 감지 사유]를 기록합니다.
                autoFeedback.setQuery("[시스템 자동 감지 사유] " + failReason);
                // - answer(답변) 칸에는 30초가 넘었거나 헛소리를 한 문제의 AI 답변 전체를 박아넣습니다.
                autoFeedback.setAnswer(content);

                // 💡 3. Lombok 규칙에 맞게 세터 이름 변경
                autoFeedback.setPositive(false);

                feedbackLogRepository.save(autoFeedback);

                System.out.println("🚨 [시스템 자동 감지] 기준 미달 답변 적발! 오답 노트 강제 적재 완료 ➔ 사유: " + failReason);
            }
        }
    }

    // 3-a. 팀 채널 캔버스 저장 + WebSocket 브로드캐스트
    @Transactional
    public void saveCanvas(String sessionIdStr, Map<String, Object> canvasData) {
        ChatSession session = chatSessionRepository.findById(UUID.fromString(sessionIdStr))
                .orElseThrow(() -> new RuntimeException("세션 없음"));
        try {
            String json = objectMapper.writeValueAsString(canvasData);
            session.setCanvasData(json);
            chatSessionRepository.save(session);
            if (session.getWorkspace() != null) {
                Map<String, Object> payload = new HashMap<>();
                payload.put("type", "canvas_update");
                payload.put("sessionId", sessionIdStr);
                payload.put("data", canvasData);
                chatWebSocketHandler.broadcast(
                        session.getWorkspace().getId().toString(),
                        objectMapper.writeValueAsString(payload)
                );
            }
        } catch (Exception ignored) {}
    }

    // 3-b. 팀 채널 캔버스 조회
    public Object getCanvas(String sessionIdStr) {
        return chatSessionRepository.findById(UUID.fromString(sessionIdStr))
                .map(s -> {
                    String json = s.getCanvasData();
                    if (json == null || json.isBlank()) return null;
                    try { return objectMapper.readValue(json, Object.class); }
                    catch (Exception e) { return null; }
                })
                .orElse(null);
    }

    // 4. 과거 대화 내역 불러오기 (비밀/공용 필터링)
    public List<Map<String, String>> getChatHistory(String sessionIdStr, boolean isPrivate) {
        UUID sessionId = UUID.fromString(sessionIdStr);

        // 💡 [핵심] 기존 findBySessionIdOrderByCreatedAtAsc 대신 비밀 여부까지 확인하는 전용 탐지기 사용!
        List<ChatMessage> messages = chatMessageRepository.findBySessionIdAndIsPrivateOrderByCreatedAtAsc(sessionId, isPrivate);

        return messages.stream().map(msg -> {
            java.util.Map<String, String> m = new java.util.HashMap<>();
            boolean isCustomAgent = msg.getSenderName() != null && msg.getSenderName().startsWith("AGENT:");
            if (msg.getSenderType().equals("USER")) {
                m.put("sender", "user");
            } else if (isCustomAgent) {
                m.put("sender", "custom_agent");
                m.put("agentName", msg.getSenderName().substring(6)); // "AGENT:" 접두사 제거
            } else {
                m.put("sender", "ai");
            }
            m.put("text", msg.getContent());
            return m;
        }).toList();
    }
}