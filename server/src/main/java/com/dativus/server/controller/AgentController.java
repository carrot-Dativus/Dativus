package com.dativus.server.controller;

import com.dativus.server.entity.Agent;
import com.dativus.server.entity.AgentUsageLog;
import com.dativus.server.repository.AgentUsageLogRepository;
import com.dativus.server.service.AgentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/v1/agents")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;
    private final AgentUsageLogRepository agentUsageLogRepository;

    // 🟢 1. 자아 생성 창구 (POST)
    @PostMapping
    public ResponseEntity<?> createAgent(@RequestBody Map<String, Object> request) {
        try {
            Double threshold = request.get("threshold") != null
                    ? ((Number) request.get("threshold")).doubleValue() : 0.38;
            Agent agent = agentService.createAgent(
                    (String) request.get("userId"),
                    (String) request.get("name"),
                    (String) request.get("description"),
                    (String) request.get("agentType"),
                    threshold
            );
            return ResponseEntity.ok(Map.of(
                    "message", "새로운 자아가 성공적으로 탄생했습니다!",
                    "agentId", agent.getId().toString()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 🟢 2. 내 자아 목록 조회 창구 (GET)
    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getUserAgents(@PathVariable String userId) {
        try {
            List<Agent> agents = agentService.getAgentsByOwner(userId);
            List<Map<String, Object>> result = agents.stream().map(a -> {
                Map<String, Object> m = new HashMap<>();
                m.put("id", a.getId().toString());
                m.put("name", a.getName());
                m.put("description", a.getDescription());
                m.put("agentType", a.getAgentType());
                m.put("threshold", a.getThreshold() != null ? a.getThreshold() : 0.38);
                return m;
            }).toList();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("자아 목록을 불러오는 데 실패했습니다.");
        }
    }

    // 🟡 3. 자아 수정 창구 (PUT)
    @PutMapping("/{agentId}")
    public ResponseEntity<?> updateAgent(@PathVariable String agentId, @RequestBody Map<String, Object> request) {
        try {
            Double threshold = request.get("threshold") != null
                    ? ((Number) request.get("threshold")).doubleValue() : null;
            Agent agent = agentService.updateAgent(
                    agentId,
                    (String) request.get("name"),
                    (String) request.get("description"),
                    (String) request.get("agentType"),
                    threshold
            );
            return ResponseEntity.ok(Map.of(
                    "message", "자아가 성공적으로 수정되었습니다.",
                    "agentId", agent.getId().toString()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 🔴 4. 자아 삭제 창구 (DELETE)
    @DeleteMapping("/{agentId}")
    public ResponseEntity<?> deleteAgent(@PathVariable String agentId) {
        try {
            agentService.deleteAgent(agentId);
            return ResponseEntity.ok(Map.of("message", "자아가 성공적으로 삭제되었습니다."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 📊 5. 에이전트 사용 기록 저장 (POST)
    @PostMapping("/usage")
    public ResponseEntity<?> recordUsage(@RequestBody Map<String, Object> request) {
        AgentUsageLog log = new AgentUsageLog();
        log.setUserId((String) request.get("userId"));
        log.setWorkspaceId((String) request.get("workspaceId"));
        log.setAgentName((String) request.get("agentName"));
        agentUsageLogRepository.save(log);
        return ResponseEntity.ok(Map.of("status", "success"));
    }

    // 📊 6. 사용자별 에이전트 사용 집계 조회 (GET)
    @GetMapping("/usage/user/{userId}")
    public ResponseEntity<?> getUsageStats(@PathVariable String userId) {
        List<Object[]> rows = agentUsageLogRepository.countByUserIdGroupByAgentName(userId);
        Map<String, Long> usage = new HashMap<>();
        for (Object[] row : rows) {
            usage.put((String) row[0], (Long) row[1]);
        }
        return ResponseEntity.ok(usage);
    }
}