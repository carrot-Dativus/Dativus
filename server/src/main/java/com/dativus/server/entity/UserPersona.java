package com.dativus.server.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.util.UUID;

@Entity
@Table(name = "user_personas")
@Getter
@NoArgsConstructor
public class UserPersona {

    @Id
    private UUID userId;

    @OneToOne
    @MapsId // User의 PK를 UserPersona의 PK로 그대로 사용하겠다는 의미
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "decision_style")
    private String decisionStyle;

    private String expertise;

    private String tone;
}