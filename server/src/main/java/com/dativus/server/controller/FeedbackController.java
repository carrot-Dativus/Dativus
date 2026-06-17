package com.dativus.server.controller;

import com.dativus.server.entity.FeedbackLog;
import com.dativus.server.repository.FeedbackLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/feedback")
public class FeedbackController {

    @Autowired
    private FeedbackLogRepository feedbackLogRepository;

    @PostMapping
    public ResponseEntity<?> saveFeedback(@RequestBody Map<String, Object> request) {
        FeedbackLog log = new FeedbackLog();
        log.setWorkspaceId((String) request.get("workspaceId"));
        log.setUserId((String) request.get("userId"));
        log.setQuery((String) request.get("query"));
        log.setAnswer((String) request.get("answer"));
        log.setPositive((Boolean) request.get("isPositive"));

        feedbackLogRepository.save(log);

        return ResponseEntity.ok().body(Map.of("status", "success", "message", "피드백이 자산화되었습니다."));
    }

    @GetMapping("/stats/{userId}")
    public ResponseEntity<?> getMyPerformanceStats(@PathVariable String userId) {
        long totalCount = feedbackLogRepository.countByUserId(userId);
        long positiveCount = feedbackLogRepository.countByUserIdAndIsPositiveTrue(userId);
        List<FeedbackLog> failureLogs = feedbackLogRepository.findByUserIdAndIsPositiveFalseOrderByCreatedAtDesc(userId);

        // CSAT(만족도) 계산
        double csatScore = totalCount == 0 ? 0 : (double) positiveCount / totalCount * 100;

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalInteractions", totalCount);
        stats.put("csatScore", Math.round(csatScore)); // 반올림
        stats.put("failureLogs", failureLogs); // 👎 받은 로그들 (Level 3)

        return ResponseEntity.ok(stats);
    }

    @GetMapping("/stats/daily/{userId}")
    public ResponseEntity<?> getDailyStats(@PathVariable String userId) {
        LocalDateTime since = LocalDate.now().minusDays(6).atStartOfDay();
        List<Object[]> rows = feedbackLogRepository.findDailyScoreByUserId(userId, since);

        // DB 결과를 날짜 문자열 → 점수 맵으로 변환
        Map<String, Integer> scoreByDate = new HashMap<>();
        for (Object[] row : rows) {
            String dateStr = row[0].toString(); // "2026-05-21"
            int score = ((Number) row[1]).intValue();
            scoreByDate.put(dateStr, score);
        }

        // 최근 7일 그리드 생성 (데이터 없는 날은 null)
        LocalDate today = LocalDate.now();
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            String dateStr = date.toString();
            String label = i == 0 ? "오늘" : (date.getMonthValue() + "/" + date.getDayOfMonth());
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("name", label);
            entry.put("score", scoreByDate.containsKey(dateStr) ? scoreByDate.get(dateStr) : null);
            result.add(entry);
        }

        return ResponseEntity.ok(result);
    }
}