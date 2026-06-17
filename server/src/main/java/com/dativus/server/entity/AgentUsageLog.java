package com.dativus.server.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "agent_usage_logs")
@Getter
@Setter
@NoArgsConstructor
public class AgentUsageLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "workspace_id")
    private String workspaceId;

    @Column(name = "agent_name", nullable = false, length = 200)
    private String agentName;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
