package com.dativus.server.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
// UserRegisterRequest.java

@Getter
@Setter
@NoArgsConstructor
public class UserRegisterRequest {
    private String username;
    private String email;
    private String password;

    // v4.0 추가: 선택적 페르소나 정보 (입력 안 하면 기본값)
    private PersonaDto persona;

    @Getter
    @Setter
    public static class PersonaDto {
        private String decisionStyle; // "논리적", "직관적" 등
        private String expertise;     // "백엔드", "프론트엔드" 등
        private String tone;          // "친절한", "전문적인" 등
        private String personaMemo;   // 자유 입력형 개인화 지시문 (Phase 1)
    }
}