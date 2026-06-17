package com.dativus.server.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "agents")
@Getter
@Setter // 💡 Setter 추가!
@NoArgsConstructor
public class Agent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // 💡 [신규 추가] 이 에이전트(자아)를 생성한 주인(User)이 누구인지 연결 (N:1)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    @Column(name = "agent_type", nullable = false, length = 50)
    private String agentType; // LOCAL / EXTERNAL_API

    @Column(name = "model_name", length = 100)
    private String modelName;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "threshold", nullable = false, columnDefinition = "DOUBLE PRECISION DEFAULT 0.38")
    private Double threshold = 0.38;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}