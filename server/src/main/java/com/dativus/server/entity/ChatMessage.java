package com.dativus.server.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "chat_messages")
@Getter
@Setter
@NoArgsConstructor
public class ChatMessage {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private ChatSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id") // AI 메시지는 NULL 가능 [cite: 189]
    private User user;

    @Column(name = "sender_type", nullable = false)
    private String senderType; // USER / LOCAL_AI / EXTERNAL_AI [cite: 189]

    @Column(name = "sender_name", nullable = false)
    private String senderName;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "router_level")
    private String routerLevel;

    @Column(name = "message_order", nullable = false, columnDefinition = "INTEGER DEFAULT 0")
    private Integer messageOrder = 0;

    @Column(name = "is_private", nullable = false, columnDefinition = "boolean default false")
    private boolean isPrivate = false;

    @JdbcTypeCode(SqlTypes.JSON) // PostgreSQL의 JSONB 타입을 매핑 [cite: 190]
    @Column(name = "source_documents", columnDefinition = "jsonb")
    private String sourceDocuments;

    @Column(name = "latency")
    private Double latency = 0.0;

    @Column(name = "tokens")
    private Integer tokens = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}