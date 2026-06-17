package com.dativus.server.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // ❌ 과거 잔재(Workspace 직접 연결) 삭제 완료!

    @Column(nullable = false)
    private String username;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "persona_decision_style")
    private String personaDecisionStyle;

    @Column(name = "persona_expertise")
    private String personaExpertise;

    @Column(name = "persona_tone")
    private String personaTone;

    // 자유 입력형 개인화 지시문 (Phase 1)
    // TODO: Phase 2 — 피드백(👍/👎) 누적 데이터를 기반으로 자동 학습된 개인화 문서를
    //   대시보드 형태로 사용자에게 시각화 제공 예정 (자동학습형 개인화)
    @Column(name = "persona_memo", columnDefinition = "TEXT")
    private String personaMemo;

    // ⭕ 새로운 중간 다리 (입장권 주머니) 장착 완료!
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<WorkspaceMember> workspaceMembers = new ArrayList<>();

    public void updatePersona(String decisionStyle, String expertise, String tone, String personaMemo) {
        this.personaDecisionStyle = decisionStyle;
        this.personaExpertise = expertise;
        this.personaTone = tone;
        this.personaMemo = personaMemo;
    }

    // 💡 생성자에서도 workspace 제거! (유저는 가입 시점에 방이 없을 수도 있으니까요)
    public User(String username, String email, String passwordHash) {
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
    }
}