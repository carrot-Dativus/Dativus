package com.dativus.server.controller;

import com.dativus.server.dto.LoginRequest;
import com.dativus.server.dto.LoginResponse;
import com.dativus.server.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            LoginResponse response = authService.login(request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody Map<String, String> request) {
        try {
            String refreshToken = request.get("refresh_token");
            if (refreshToken == null || refreshToken.isBlank()) {
                return ResponseEntity.status(400).body(Map.of("error", "refresh_token이 필요합니다."));
            }
            LoginResponse response = authService.refresh(refreshToken);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestBody Map<String, String> request) {
        String refreshToken = request.get("refresh_token");
        if (refreshToken != null) {
            authService.logout(refreshToken);
        }
        return ResponseEntity.ok(Map.of("message", "로그아웃 완료"));
    }
}
