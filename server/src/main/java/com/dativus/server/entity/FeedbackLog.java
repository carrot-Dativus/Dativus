package com.dativus.server.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "feedback_logs")
@Getter
@Setter
@NoArgsConstructor
public class FeedbackLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "workspace_id")
    private String workspaceId;

    @Column(name = "user_id")
    private String userId;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String query; // 사용자가 던진 질문

    @Column(columnDefinition = "TEXT", nullable = false)
    private String answer; // AI가 대답한 내용

    @Column(name = "is_positive", nullable = false)
    private boolean isPositive; // true(👍) or false(👎)

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}