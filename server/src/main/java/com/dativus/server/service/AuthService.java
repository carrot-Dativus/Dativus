package com.dativus.server.service;

import com.dativus.server.dto.LoginRequest;
import com.dativus.server.dto.LoginResponse;
import com.dativus.server.entity.RefreshToken;
import com.dativus.server.entity.User;
import com.dativus.server.repository.RefreshTokenRepository;
import com.dativus.server.repository.UserRepository;
import com.dativus.server.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtUtil jwtUtil;
    private final BCryptPasswordEncoder passwordEncoder;

    private static final long REFRESH_TOKEN_DAYS = 7;

    @Transactional
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("가입되지 않은 이메일입니다."));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("비밀번호가 틀렸습니다.");
        }

        String workspaceId = null;
        if (user.getWorkspaceMembers() != null && !user.getWorkspaceMembers().isEmpty()) {
            workspaceId = user.getWorkspaceMembers().stream()
                    .min(java.util.Comparator.comparing(com.dativus.server.entity.WorkspaceMember::getJoinedAt))
                    .map(member -> member.getWorkspace().getId().toString())
                    .orElse(null);
        }

        String accessToken = jwtUtil.generateToken(user.getId().toString(), workspaceId);
        String refreshToken = createRefreshToken(user.getId());

        return new LoginResponse(accessToken, refreshToken, "Bearer", user.getId().toString(), workspaceId, user.getUsername());
    }

    @Transactional
    public LoginResponse refresh(String refreshTokenValue) {
        RefreshToken stored = refreshTokenRepository.findByToken(refreshTokenValue)
                .orElseThrow(() -> new RuntimeException("유효하지 않은 Refresh Token입니다."));

        if (stored.isExpired()) {
            refreshTokenRepository.delete(stored);
            throw new RuntimeException("Refresh Token이 만료되었습니다. 다시 로그인해 주세요.");
        }

        User user = userRepository.findById(stored.getUserId())
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        String workspaceId = null;
        if (user.getWorkspaceMembers() != null && !user.getWorkspaceMembers().isEmpty()) {
            workspaceId = user.getWorkspaceMembers().stream()
                    .min(java.util.Comparator.comparing(com.dativus.server.entity.WorkspaceMember::getJoinedAt))
                    .map(member -> member.getWorkspace().getId().toString())
                    .orElse(null);
        }

        // 기존 refresh token 교체 (rotation)
        refreshTokenRepository.delete(stored);
        String newRefreshToken = createRefreshToken(user.getId());
        String newAccessToken = jwtUtil.generateToken(user.getId().toString(), workspaceId);

        return new LoginResponse(newAccessToken, newRefreshToken, "Bearer", user.getId().toString(), workspaceId, user.getUsername());
    }

    @Transactional
    public void logout(String refreshTokenValue) {
        refreshTokenRepository.findByToken(refreshTokenValue)
                .ifPresent(refreshTokenRepository::delete);
    }

    private String createRefreshToken(UUID userId) {
        // 기존 refresh token 삭제 (디바이스당 1개 유지)
        refreshTokenRepository.deleteByUserId(userId);

        RefreshToken refreshToken = RefreshToken.builder()
                .token(UUID.randomUUID().toString())
                .userId(userId)
                .createdAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusDays(REFRESH_TOKEN_DAYS))
                .build();

        return refreshTokenRepository.save(refreshToken).getToken();
    }
}
