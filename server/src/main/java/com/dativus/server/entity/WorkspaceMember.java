package com.dativus.server.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "workspace_members")
@Getter @Setter
@NoArgsConstructor
public class WorkspaceMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 이 입장권의 주인 (User)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // 이 입장권이 허락하는 방 (Workspace)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;

    // 방에서의 역할 (예: 방장 OWNER, 일반 멤버 MEMBER)
    @Column(nullable = false)
    private String role = "MEMBER";

    // 입장 시간
    @Column(name = "joined_at")
    private LocalDateTime joinedAt = LocalDateTime.now();

    // 연관관계 편의 메서드 (입장권 발급 시 자동 연결)
    public WorkspaceMember(User user, Workspace workspace, String role) {
        this.user = user;
        this.workspace = workspace;
        this.role = role;
    }
}