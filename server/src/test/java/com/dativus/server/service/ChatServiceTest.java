package com.dativus.server.service;

import com.dativus.server.entity.*;
import com.dativus.server.repository.*;
import com.dativus.server.websocket.ChatWebSocketHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@DisplayName("ChatService 단위 테스트")
class ChatServiceTest {

    @Mock ChatMessageRepository chatMessageRepository;
    @Mock ChatSessionRepository chatSessionRepository;
    @Mock UserRepository userRepository;
    @Mock WorkspaceRepository workspaceRepository;
    @Mock FeedbackLogRepository feedbackLogRepository;
    @Mock ChatWebSocketHandler chatWebSocketHandler;
    @Spy  ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks ChatService chatService;

    private static final UUID WORKSPACE_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID USER_ID      = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID SESSION_ID   = UUID.fromString("00000000-0000-0000-0000-000000000003");

    private Workspace workspace;

    @BeforeEach
    void setUp() {
        workspace = new Workspace("테스트팀", "ABC123");
        ReflectionTestUtils.setField(workspace, "id", WORKSPACE_ID);
    }

    // ─── 헬퍼 ─────────────────────────────────────────────────────────────────

    private ChatSession newSession(String type, String title) {
        ChatSession s = new ChatSession();
        s.setWorkspace(workspace);
        s.setTitle(title);
        s.setSessionType(type);
        return s;
    }

    private ChatSession newSessionWithId(String type, String title) {
        ChatSession s = newSession(type, title);
        ReflectionTestUtils.setField(s, "id", SESSION_ID);
        return s;
    }

    private ChatMessage newMessage(String senderType, String senderName, String content,
                                   boolean isPrivate, double latency) {
        ChatMessage m = new ChatMessage();
        m.setSession(newSessionWithId("TEAM_CHANNEL", "일반"));
        m.setSenderType(senderType);
        m.setSenderName(senderName);
        m.setContent(content);
        m.setPrivate(isPrivate);
        m.setLatency(latency);
        m.setTokens(0);
        return m;
    }

    // =========================================================================
    // createSession
    // =========================================================================

    @Nested
    @DisplayName("createSession — 세션 생성")
    class CreateSession {

        @Test
        @DisplayName("TEAM_CHANNEL 세션이 올바른 타입/제목으로 생성된다")
        void teamChannel_savedWithCorrectFields() {
            given(workspaceRepository.findById(WORKSPACE_ID)).willReturn(Optional.of(workspace));
            given(chatSessionRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

            ChatSession result = chatService.createSession(
                    WORKSPACE_ID.toString(), "백엔드-논의", "TEAM_CHANNEL", null);

            assertThat(result.getTitle()).isEqualTo("백엔드-논의");
            assertThat(result.getSessionType()).isEqualTo("TEAM_CHANNEL");
            assertThat(result.getUserId()).isNull();
        }

        @Test
        @DisplayName("PERSONAL 세션 생성 시 userId가 저장된다")
        void personal_savesUserId() {
            given(workspaceRepository.findById(WORKSPACE_ID)).willReturn(Optional.of(workspace));
            given(chatSessionRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

            ChatSession result = chatService.createSession(
                    WORKSPACE_ID.toString(), "내 채팅", "PERSONAL", USER_ID.toString());

            assertThat(result.getSessionType()).isEqualTo("PERSONAL");
            assertThat(result.getUserId()).isEqualTo(USER_ID);
        }

        @Test
        @DisplayName("sessionType이 null이면 기본값 TEAM_CHANNEL로 저장된다")
        void nullSessionType_defaultsToTeamChannel() {
            given(workspaceRepository.findById(WORKSPACE_ID)).willReturn(Optional.of(workspace));
            given(chatSessionRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

            ChatSession result = chatService.createSession(
                    WORKSPACE_ID.toString(), "테스트방", null, null);

            assertThat(result.getSessionType()).isEqualTo("TEAM_CHANNEL");
        }

        @Test
        @DisplayName("존재하지 않는 워크스페이스 ID → RuntimeException 발생")
        void unknownWorkspace_throwsRuntimeException() {
            given(workspaceRepository.findById(WORKSPACE_ID)).willReturn(Optional.empty());

            assertThatThrownBy(() ->
                chatService.createSession(WORKSPACE_ID.toString(), "방", "TEAM_CHANNEL", null)
            ).isInstanceOf(RuntimeException.class)
             .hasMessageContaining("워크스페이스를 찾을 수 없습니다");
        }
    }

    // =========================================================================
    // listSessions
    // =========================================================================

    @Nested
    @DisplayName("listSessions — 세션 목록 조회")
    class ListSessions {

        @Test
        @DisplayName("팀 채널과 개인 채팅을 모두 반환한다")
        void returnsBothTeamAndPersonal() {
            ChatSession team     = newSessionWithId("TEAM_CHANNEL", "일반");
            ChatSession personal = newSession("PERSONAL", "내 채팅");
            ReflectionTestUtils.setField(personal, "id", UUID.randomUUID());

            given(chatSessionRepository.findNullTypeSessions(WORKSPACE_ID)).willReturn(List.of());
            given(chatSessionRepository.findTeamChannelsByWorkspaceId(WORKSPACE_ID)).willReturn(List.of(team));
            given(chatSessionRepository.findPersonalChatsByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
                    .willReturn(List.of(personal));

            Map<String, Object> result = chatService.listSessions(
                    WORKSPACE_ID.toString(), USER_ID.toString());

            assertThat((List<?>) result.get("teamChannels")).hasSize(1);
            assertThat((List<?>) result.get("personalChats")).hasSize(1);
        }

        @Test
        @DisplayName("레거시 null 세션 '기본 채팅방' → TEAM_CHANNEL '일반'으로 마이그레이션")
        void nullSession_defaultTitle_migratedToIlban() {
            ChatSession legacy = newSessionWithId(null, "기본 채팅방");
            legacy.setSessionType(null);

            given(chatSessionRepository.findNullTypeSessions(WORKSPACE_ID)).willReturn(List.of(legacy));
            given(chatSessionRepository.findTeamChannelsByWorkspaceId(WORKSPACE_ID)).willReturn(List.of(legacy));
            given(chatSessionRepository.findPersonalChatsByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
                    .willReturn(List.of());
            given(workspaceRepository.findById(WORKSPACE_ID)).willReturn(Optional.of(workspace));
            given(chatSessionRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

            chatService.listSessions(WORKSPACE_ID.toString(), USER_ID.toString());

            ArgumentCaptor<ChatSession> captor = ArgumentCaptor.forClass(ChatSession.class);
            // 마이그레이션 save + 기본 개인 채팅 save = 2번
            verify(chatSessionRepository, times(2)).save(captor.capture());

            // 첫 번째 save가 마이그레이션된 세션
            ChatSession migrated = captor.getAllValues().get(0);
            assertThat(migrated.getSessionType()).isEqualTo("TEAM_CHANNEL");
            assertThat(migrated.getTitle()).isEqualTo("일반");
        }

        @Test
        @DisplayName("레거시 null 세션 커스텀 제목 → 타입만 TEAM_CHANNEL로, 제목은 유지")
        void nullSession_customTitle_keepsTitleOnMigration() {
            ChatSession legacy = newSessionWithId(null, "우리팀방");
            legacy.setSessionType(null);

            given(chatSessionRepository.findNullTypeSessions(WORKSPACE_ID)).willReturn(List.of(legacy));
            given(chatSessionRepository.findTeamChannelsByWorkspaceId(WORKSPACE_ID)).willReturn(List.of(legacy));
            given(chatSessionRepository.findPersonalChatsByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
                    .willReturn(List.of());
            given(workspaceRepository.findById(WORKSPACE_ID)).willReturn(Optional.of(workspace));
            given(chatSessionRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

            chatService.listSessions(WORKSPACE_ID.toString(), USER_ID.toString());

            ArgumentCaptor<ChatSession> captor = ArgumentCaptor.forClass(ChatSession.class);
            verify(chatSessionRepository, times(2)).save(captor.capture());
            assertThat(captor.getAllValues().get(0).getTitle()).isEqualTo("우리팀방");
        }

        @Test
        @DisplayName("null 세션 여러 개 → 가장 오래된 것(첫 번째)만 마이그레이션 (1회 save)")
        void multipleNullSessions_onlyFirstMigrated() {
            ChatSession first  = newSessionWithId(null, "방1");
            ChatSession second = newSession(null, "방2");
            ReflectionTestUtils.setField(second, "id", UUID.randomUUID());

            given(chatSessionRepository.findNullTypeSessions(WORKSPACE_ID))
                    .willReturn(List.of(first, second));
            given(chatSessionRepository.findTeamChannelsByWorkspaceId(WORKSPACE_ID))
                    .willReturn(List.of(first));
            given(chatSessionRepository.findPersonalChatsByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
                    .willReturn(List.of());
            given(workspaceRepository.findById(WORKSPACE_ID)).willReturn(Optional.of(workspace));
            given(chatSessionRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

            chatService.listSessions(WORKSPACE_ID.toString(), USER_ID.toString());

            // 마이그레이션 1번 + 기본 개인 채팅 생성 1번 = 총 2번
            verify(chatSessionRepository, times(2)).save(any());
            // second 세션은 수정되지 않음
            assertThat(second.getSessionType()).isNull();
        }

        @Test
        @DisplayName("개인 채팅 없을 때 → '개인 AI 채팅' 기본 세션 자동 생성")
        void noPersonalChat_autoCreatesDefault() {
            ChatSession created = newSession("PERSONAL", "개인 AI 채팅");
            created.setUserId(USER_ID);
            ReflectionTestUtils.setField(created, "id", UUID.randomUUID());

            given(chatSessionRepository.findNullTypeSessions(WORKSPACE_ID)).willReturn(List.of());
            given(chatSessionRepository.findTeamChannelsByWorkspaceId(WORKSPACE_ID)).willReturn(List.of());
            given(chatSessionRepository.findPersonalChatsByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
                    .willReturn(List.of())       // 첫 조회: 없음
                    .willReturn(List.of(created)); // 생성 후 재조회: 있음
            given(workspaceRepository.findById(WORKSPACE_ID)).willReturn(Optional.of(workspace));
            given(chatSessionRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

            Map<String, Object> result = chatService.listSessions(
                    WORKSPACE_ID.toString(), USER_ID.toString());

            assertThat((List<?>) result.get("personalChats")).hasSize(1);

            ArgumentCaptor<ChatSession> captor = ArgumentCaptor.forClass(ChatSession.class);
            verify(chatSessionRepository).save(captor.capture());
            assertThat(captor.getValue().getTitle()).isEqualTo("개인 AI 채팅");
            assertThat(captor.getValue().getSessionType()).isEqualTo("PERSONAL");
            assertThat(captor.getValue().getUserId()).isEqualTo(USER_ID);
        }

        @Test
        @DisplayName("userId 없이 호출 → 개인 채팅 조회 건너뜀, personalChats 빈 리스트")
        void noUserId_skipsPersonalChatQuery() {
            given(chatSessionRepository.findNullTypeSessions(WORKSPACE_ID)).willReturn(List.of());
            given(chatSessionRepository.findTeamChannelsByWorkspaceId(WORKSPACE_ID)).willReturn(List.of());

            Map<String, Object> result = chatService.listSessions(WORKSPACE_ID.toString(), null);

            assertThat((List<?>) result.get("personalChats")).isEmpty();
            verify(chatSessionRepository, never())
                    .findPersonalChatsByWorkspaceIdAndUserId(any(), any());
        }
    }

    // =========================================================================
    // saveMessage
    // =========================================================================

    @Nested
    @DisplayName("saveMessage — 메시지 저장")
    @MockitoSettings(strictness = Strictness.LENIENT)
    class SaveMessage {

        private ChatSession teamSession;

        @BeforeEach
        void setUpSession() {
            teamSession = newSessionWithId("TEAM_CHANNEL", "일반");
            given(chatSessionRepository.findById(SESSION_ID)).willReturn(Optional.of(teamSession));
            given(userRepository.findById(any())).willReturn(Optional.empty());
            given(chatMessageRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
        }

        @Test
        @DisplayName("공개 메시지(isPrivate=false) → WS broadcast 호출됨")
        void publicMessage_broadcastCalled() {
            chatService.saveMessage(SESSION_ID.toString(), null,
                    "LOCAL_AI", "AI", "답변입니다.", false, 1.0, 10, 1);

            verify(chatWebSocketHandler).broadcast(eq(WORKSPACE_ID.toString()), anyString());
        }

        @Test
        @DisplayName("비밀 메시지(isPrivate=true) → WS broadcast 호출 안 됨")
        void privateMessage_noBroadcast() {
            chatService.saveMessage(SESSION_ID.toString(), null,
                    "LOCAL_AI", "AI", "비밀 답변.", true, 1.0, 10, 1);

            verify(chatWebSocketHandler, never()).broadcast(any(), any());
        }

        @Test
        @DisplayName("WS broadcast 페이로드에 sessionId가 포함된다")
        void broadcastPayload_containsSessionId() throws Exception {
            chatService.saveMessage(SESSION_ID.toString(), null,
                    "LOCAL_AI", "AI", "답변.", false, 1.0, 10, 1);

            ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
            verify(chatWebSocketHandler).broadcast(any(), jsonCaptor.capture());

            @SuppressWarnings("unchecked")
            Map<String, Object> payload = objectMapper.readValue(jsonCaptor.getValue(), Map.class);
            assertThat(payload.get("sessionId")).isEqualTo(SESSION_ID.toString());
        }

        @Test
        @DisplayName("커스텀 에이전트 메시지(AGENT:봇) → broadcast sender=custom_agent, agentName 포함")
        void agentMessage_broadcastHasCustomAgentFields() throws Exception {
            chatService.saveMessage(SESSION_ID.toString(), null,
                    "LOCAL_AI", "AGENT:분석봇", "분석 결과.", false, 2.0, 50, 1);

            ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
            verify(chatWebSocketHandler).broadcast(any(), jsonCaptor.capture());

            @SuppressWarnings("unchecked")
            Map<String, Object> payload = objectMapper.readValue(jsonCaptor.getValue(), Map.class);
            assertThat(payload.get("sender")).isEqualTo("custom_agent");
            assertThat(payload.get("agentName")).isEqualTo("분석봇");
        }

        // ── 자동 실패 감지 (Rule-Engine) ──────────────────────────────────────

        @Test
        @DisplayName("AI 응답 latency > 30초 → FeedbackLog 자동 저장")
        void latencyExceeds30s_feedbackLogSaved() {
            chatService.saveMessage(SESSION_ID.toString(), USER_ID.toString(),
                    "LOCAL_AI", "AI", "늦은 답변.", false, 31.5, 100, 1);

            ArgumentCaptor<FeedbackLog> captor = ArgumentCaptor.forClass(FeedbackLog.class);
            verify(feedbackLogRepository).save(captor.capture());
            assertThat(captor.getValue().isPositive()).isFalse();
            assertThat(captor.getValue().getQuery()).contains("응답 지연 초과");
        }

        @Test
        @DisplayName("AI 응답 '잘 모르겠습니다' 포함 → FeedbackLog 자동 저장")
        void hallucinationKeyword_moreu_feedbackLogSaved() {
            chatService.saveMessage(SESSION_ID.toString(), null,
                    "LOCAL_AI", "AI", "죄송하지만 잘 모르겠습니다.", false, 1.0, 10, 1);

            verify(feedbackLogRepository).save(any(FeedbackLog.class));
        }

        @Test
        @DisplayName("AI 응답 '알 수 없습니다' 포함 → FeedbackLog 자동 저장")
        void hallucinationKeyword_alsu_feedbackLogSaved() {
            chatService.saveMessage(SESSION_ID.toString(), null,
                    "LOCAL_AI", "AI", "이 내용은 알 수 없습니다.", false, 1.0, 10, 1);

            verify(feedbackLogRepository).save(any(FeedbackLog.class));
        }

        @Test
        @DisplayName("AI 응답 '정보가 없습니다' 포함 → FeedbackLog 자동 저장")
        void hallucinationKeyword_jungbo_feedbackLogSaved() {
            chatService.saveMessage(SESSION_ID.toString(), null,
                    "LOCAL_AI", "AI", "관련 정보가 없습니다.", false, 1.0, 10, 1);

            verify(feedbackLogRepository).save(any(FeedbackLog.class));
        }

        @Test
        @DisplayName("AI 정상 응답 (latency ≤ 30초, 키워드 없음) → FeedbackLog 저장 안 됨")
        void normalAiResponse_noFeedbackLog() {
            chatService.saveMessage(SESSION_ID.toString(), null,
                    "LOCAL_AI", "AI", "잘 분석된 정상 답변입니다.", false, 2.5, 80, 1);

            verify(feedbackLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("USER 메시지 → 자동 실패 감지 룰 적용 안 됨 (FeedbackLog 저장 안 됨)")
        void userMessage_ruleEngineSkipped() {
            chatService.saveMessage(SESSION_ID.toString(), USER_ID.toString(),
                    "USER", "사용자", "잘 모르겠습니다.", false, 0.0, 0, 0);

            verify(feedbackLogRepository, never()).save(any());
        }
    }

    // =========================================================================
    // getChatHistory
    // =========================================================================

    @Nested
    @DisplayName("getChatHistory — 대화 내역 조회")
    class GetChatHistory {

        @Test
        @DisplayName("USER 메시지 → sender: 'user'")
        void userMessage_senderIsUser() {
            ChatMessage msg = newMessage("USER", "사용자", "안녕하세요", false, 0);
            given(chatMessageRepository.findBySessionIdAndIsPrivateOrderByCreatedAtAsc(SESSION_ID, false))
                    .willReturn(List.of(msg));

            List<Map<String, String>> result = chatService.getChatHistory(SESSION_ID.toString(), false);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).get("sender")).isEqualTo("user");
        }

        @Test
        @DisplayName("LOCAL_AI 메시지 → sender: 'ai'")
        void aiMessage_senderIsAi() {
            ChatMessage msg = newMessage("LOCAL_AI", "AI 어시스턴트", "답변입니다.", false, 0);
            given(chatMessageRepository.findBySessionIdAndIsPrivateOrderByCreatedAtAsc(SESSION_ID, false))
                    .willReturn(List.of(msg));

            List<Map<String, String>> result = chatService.getChatHistory(SESSION_ID.toString(), false);

            assertThat(result.get(0).get("sender")).isEqualTo("ai");
        }

        @Test
        @DisplayName("AGENT:분석봇 → sender: 'custom_agent', agentName: '분석봇'")
        void agentMessage_senderIsCustomAgent_withAgentName() {
            ChatMessage msg = newMessage("LOCAL_AI", "AGENT:분석봇", "분석 결과.", false, 0);
            given(chatMessageRepository.findBySessionIdAndIsPrivateOrderByCreatedAtAsc(SESSION_ID, false))
                    .willReturn(List.of(msg));

            List<Map<String, String>> result = chatService.getChatHistory(SESSION_ID.toString(), false);

            assertThat(result.get(0).get("sender")).isEqualTo("custom_agent");
            assertThat(result.get(0).get("agentName")).isEqualTo("분석봇");
        }

        @Test
        @DisplayName("메시지 없음 → 빈 리스트 반환")
        void noMessages_returnsEmptyList() {
            given(chatMessageRepository.findBySessionIdAndIsPrivateOrderByCreatedAtAsc(SESSION_ID, false))
                    .willReturn(List.of());

            assertThat(chatService.getChatHistory(SESSION_ID.toString(), false)).isEmpty();
        }

        @Test
        @DisplayName("isPrivate=true 조회 → private 파라미터가 그대로 리포지토리에 전달된다")
        void privateQuery_passesIsPrivateTrueToRepository() {
            given(chatMessageRepository.findBySessionIdAndIsPrivateOrderByCreatedAtAsc(SESSION_ID, true))
                    .willReturn(List.of());

            chatService.getChatHistory(SESSION_ID.toString(), true);

            verify(chatMessageRepository)
                    .findBySessionIdAndIsPrivateOrderByCreatedAtAsc(SESSION_ID, true);
        }
    }
}
