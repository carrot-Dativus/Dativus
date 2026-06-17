package com.dativus.server.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList; // 💡 추가
import java.util.List;      // 💡 추가
import java.util.UUID;

@Entity
@Table(name = "workspaces")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class Workspace {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    // 💡 v4.0 추가: 팀원들이 입력하고 들어올 6자리 초대 코드
    @Column(name = "invite_code", unique = true, nullable = false)
    private String inviteCode;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // 💡 v4.0 수정: 직접 User를 가지지 않고, 입장권(WorkspaceMember) 명부를 가집니다!
    @OneToMany(mappedBy = "workspace", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<WorkspaceMember> members = new ArrayList<>();



    // 💡 서비스 코드에서 사용할 생성자 업데이트
    public Workspace(String name, String inviteCode) {
        this.name = name;
        this.inviteCode = inviteCode;
    }
}