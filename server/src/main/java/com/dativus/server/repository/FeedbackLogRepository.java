package com.dativus.server.repository;

import com.dativus.server.entity.FeedbackLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface FeedbackLogRepository extends JpaRepository<FeedbackLog, UUID> {
    // 특정 유저의 피드백을 최신순으로 정렬
    List<FeedbackLog> findByUserIdOrderByCreatedAtDesc(String userId);

    // 특정 유저의 부정적 피드백(오답 노트)만 추출
    List<FeedbackLog> findByUserIdAndIsPositiveFalseOrderByCreatedAtDesc(String userId);

    // 통계를 위한 카운트
    long countByUserId(String userId);
    long countByUserIdAndIsPositiveTrue(String userId);

    // 일별 CSAT 집계 (최근 7일)
    @Query(value = "SELECT DATE(created_at) as day, " +
                   "ROUND(COUNT(*) FILTER (WHERE is_positive = true) * 100.0 / COUNT(*)) as score " +
                   "FROM feedback_logs " +
                   "WHERE user_id = :userId AND created_at >= :since " +
                   "GROUP BY DATE(created_at) " +
                   "ORDER BY DATE(created_at) ASC",
           nativeQuery = true)
    List<Object[]> findDailyScoreByUserId(@Param("userId") String userId, @Param("since") LocalDateTime since);
}