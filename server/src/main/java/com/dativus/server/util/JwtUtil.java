package com.dativus.server.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expirationTime;

    public JwtUtil(@Value("${jwt.secret}") String secret,
                   @Value("${jwt.expiration_time}") long expirationTime) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationTime = expirationTime;
    }

    public String generateToken(String userId, String workspaceId) {
        return Jwts.builder()
                .claim("user_id", userId)
                .claim("workspace_id", workspaceId)
                // 💡 [수정됨] 0.12.x 최신 문법: setIssuedAt -> issuedAt
                .issuedAt(new Date(System.currentTimeMillis()))
                // 💡 [수정됨] 0.12.x 최신 문법: setExpiration -> expiration
                .expiration(new Date(System.currentTimeMillis() + expirationTime))
                .signWith(key)
                .compact();
    }

    public boolean validateToken(String token) {
        try {
            // 💡 [수정됨] 0.12.x 최신 문법: parserBuilder() 삭제, verifyWith() 사용
            Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token); // parseClaimsJws -> parseSignedClaims
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            System.out.println("🚨 유효하지 않은 JWT 토큰 접근 시도: " + e.getMessage());
            return false;
        }
    }

    public String getUserIdFromToken(String token) {
        // 💡 [수정됨] 0.12.x 최신 문법: getBody() -> getPayload()
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        return claims.get("user_id", String.class);
    }
}