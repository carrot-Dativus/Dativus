package com.dativus.server.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "chat_sessions")
@Getter
@Setter
@NoArgsConstructor
public class ChatSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;

    @Column(nullable = false)
    private String title;

    // 💡 [신규 추가 핵심!] 이 채팅방에 참여 중인 에이전트들 (M:N 다대다 매핑)
    // 이제 하나의 채팅방에 여러 에이전트를 마음껏 초대할 수 있습니다!
    @ManyToMany
    @JoinTable(
            name = "session_agents", // 중간 연결 테이블 이름
            joinColumns = @JoinColumn(name = "session_id"),
            inverseJoinColumns = @JoinColumn(name = "agent_id")
    )
    private List<Agent> participatingAgents = new ArrayList<>();

    @Column(name = "session_type", nullable = false, columnDefinition = "VARCHAR(50) DEFAULT 'TEAM_CHANNEL'")
    private String sessionType = "TEAM_CHANNEL";

    // AI: AI 채팅방 (기존 동작), CHAT: 팀원 채팅 전용 (AI 없음)
    @Column(name = "channel_mode", nullable = false, columnDefinition = "VARCHAR(20) DEFAULT 'AI'")
    private String channelMode = "AI";

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "canvas_data", columnDefinition = "TEXT")
    private String canvasData;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}