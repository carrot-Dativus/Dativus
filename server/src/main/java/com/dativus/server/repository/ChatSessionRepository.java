package com.dativus.server.repository;

import com.dativus.server.entity.ChatSession;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ChatSessionRepository extends JpaRepository<ChatSession, UUID> {
    List<ChatSession> findByWorkspaceIdOrderByCreatedAtDesc(UUID workspaceId);

    // 팀 채널 목록 (명시적 TEAM_CHANNEL만)
    @org.springframework.data.jpa.repository.Query(
        "SELECT s FROM ChatSession s WHERE s.workspace.id = :workspaceId " +
        "AND s.sessionType = 'TEAM_CHANNEL' " +
        "ORDER BY s.createdAt ASC")
    List<ChatSession> findTeamChannelsByWorkspaceId(@org.springframework.data.repository.query.Param("workspaceId") UUID workspaceId);

    // 레거시 null 타입 세션 (마이그레이션용)
    @org.springframework.data.jpa.repository.Query(
        "SELECT s FROM ChatSession s WHERE s.workspace.id = :workspaceId " +
        "AND s.sessionType IS NULL " +
        "ORDER BY s.createdAt ASC")
    List<ChatSession> findNullTypeSessions(@org.springframework.data.repository.query.Param("workspaceId") UUID workspaceId);

    // 개인 AI 채팅 목록
    @org.springframework.data.jpa.repository.Query(
        "SELECT s FROM ChatSession s WHERE s.workspace.id = :workspaceId " +
        "AND s.sessionType = 'PERSONAL' AND s.userId = :userId " +
        "ORDER BY s.createdAt ASC")
    List<ChatSession> findPersonalChatsByWorkspaceIdAndUserId(
        @org.springframework.data.repository.query.Param("workspaceId") UUID workspaceId,
        @org.springframework.data.repository.query.Param("userId") UUID userId);
}