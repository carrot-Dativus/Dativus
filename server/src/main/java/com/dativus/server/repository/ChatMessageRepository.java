package com.dativus.server.repository;

import com.dativus.server.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    // 💡 [수정] isPrivate가 false이거나, NULL인 경우에도 모두 가져오도록 쿼리를 직접 작성합니다.
    @Query("SELECT m FROM ChatMessage m WHERE m.session.id = :sessionId " +
            "AND (:isPrivate = true AND m.isPrivate = true OR :isPrivate = false AND (m.isPrivate = false OR m.isPrivate IS NULL)) " +
            "ORDER BY m.createdAt ASC, m.messageOrder ASC")
    List<ChatMessage> findBySessionIdAndIsPrivateOrderByCreatedAtAsc(
            @Param("sessionId") UUID sessionId,
            @Param("isPrivate") boolean isPrivate
    );
}