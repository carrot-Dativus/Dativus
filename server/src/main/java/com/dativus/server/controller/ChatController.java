package com.dativus.server.controller;

import com.dativus.server.entity.ChatSession;
import com.dativus.server.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/chats")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    // 1. 방 생성 또는 가져오기
    @PostMapping("/session")
    public ResponseEntity<?> getOrCreateSession(@RequestBody Map<String, String> request) {
        String workspaceId = request.get("workspaceId");
        String title = request.getOrDefault("title", "새 채팅방");
        ChatSession session = chatService.getOrCreateSession(workspaceId, title);

        return ResponseEntity.ok(Map.of("sessionId", session.getId().toString()));
    }

    // 2. 메시지 저장하기
    @PostMapping("/messages")
    public ResponseEntity<?> saveMessage(@RequestBody Map<String, Object> request) {
        chatService.saveMessage(
                (String) request.get("sessionId"),
                (String) request.get("userId"),
                (String) request.get("senderType"),
                (String) request.get("senderName"),
                (String) request.get("content"),
                (Boolean) request.get("isPrivate"),
                // 💡 [신규 추가] 프론트가 보낸 모니터링 데이터 안전하게 변환해서 수신!
                request.get("latency") != null ? Double.valueOf(request.get("latency").toString()) : 0.0,
                request.get("tokens") != null ? Integer.valueOf(request.get("tokens").toString()) : 0,
                request.get("messageOrder") != null ? Integer.valueOf(request.get("messageOrder").toString()) : 0
        );
        return ResponseEntity.ok("메시지 저장 성공!");
    }

    // 3. 워크스페이스별 세션 목록 (사이드바용)
    @GetMapping("/workspace/{workspaceId}/sessions")
    public ResponseEntity<?> listSessions(
            @PathVariable String workspaceId,
            @RequestParam(required = false) String userId) {
        return ResponseEntity.ok(chatService.listSessions(workspaceId, userId));
    }

    // 4. 새 세션 생성 (팀 채널 or 개인 채팅)
    @PostMapping("/workspace/{workspaceId}/sessions")
    public ResponseEntity<?> createNewSession(
            @PathVariable String workspaceId,
            @RequestBody Map<String, String> request) {
        String title = request.getOrDefault("title", "새 채팅방");
        String sessionType = request.getOrDefault("sessionType", "TEAM_CHANNEL");
        String channelMode = request.getOrDefault("channelMode", "AI");
        String userId = request.get("userId");
        var session = chatService.createSession(workspaceId, title, sessionType, userId, channelMode);
        return ResponseEntity.ok(Map.of(
                "sessionId", session.getId().toString(),
                "title", session.getTitle(),
                "sessionType", session.getSessionType(),
                "channelMode", session.getChannelMode() != null ? session.getChannelMode() : "AI"
        ));
    }

    // 5. 팀 채널 캔버스 저장 (AI 응답 수신 시 호출, 전 팀원 WS 브로드캐스트)
    @PutMapping("/session/{sessionId}/canvas")
    public ResponseEntity<?> saveCanvas(
            @PathVariable String sessionId,
            @RequestBody Map<String, Object> body) {
        chatService.saveCanvas(sessionId, body);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    // 6. 팀 채널 캔버스 조회 (채널 전환 시 최신 캔버스 복원)
    @GetMapping("/session/{sessionId}/canvas")
    public ResponseEntity<?> getCanvas(@PathVariable String sessionId) {
        Object data = chatService.getCanvas(sessionId);
        if (data == null) return ResponseEntity.noContent().build();
        return ResponseEntity.ok(data);
    }

    // 7. 방 번호로 과거 대화 내역 불러오기 (비밀/공용 분리)
    @GetMapping("/session/{sessionId}/messages")
    public ResponseEntity<?> getChatHistory(
            @PathVariable String sessionId,
            @RequestParam(required = false, defaultValue = "false") boolean isPrivate) { // 💡 [핵심] 탭에 따른 분리 요청 수신!
        List<Map<String, String>> history = chatService.getChatHistory(sessionId, isPrivate);
        return ResponseEntity.ok(history);
    }
}