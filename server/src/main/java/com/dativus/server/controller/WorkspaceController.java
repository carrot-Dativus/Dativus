package com.dativus.server.controller;

import com.dativus.server.entity.User;
import com.dativus.server.entity.Workspace;
import com.dativus.server.repository.UserRepository;
import com.dativus.server.service.WorkspaceService;
import com.dativus.server.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/workspaces")
@RequiredArgsConstructor
public class WorkspaceController {

    private final WorkspaceService workspaceService;
    // 💡 [핵심 추가] 토큰을 다시 찍어내기 위해 필요한 도구들을 가져옵니다.
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    @PostMapping
    public ResponseEntity<?> createWorkspace(@RequestBody Map<String, String> request) {
        Workspace ws = workspaceService.createWorkspace(request.get("name"));
        return ResponseEntity.ok(Map.of(
                "workspaceId", ws.getId().toString(),
                "inviteCode", ws.getInviteCode(),
                "message", "워크스페이스가 생성되었습니다."
        ));
    }

    @PostMapping("/join")
    public ResponseEntity<?> joinWorkspace(@RequestBody Map<String, String> request) {
        UUID userId = UUID.fromString(request.get("userId"));
        String inviteCode = request.get("inviteCode");

        // 1. 💡 [변경] 서비스가 합류한 방(Workspace) 객체를 직접 반환하도록 수정합니다.
        Workspace joinedWs = workspaceService.joinWorkspace(userId, inviteCode);

        // 2. 💡 [재발급] 방금 합류한 방의 ID로 새 토큰을 만듭니다.
        String newWorkspaceId = joinedWs.getId().toString();
        String newToken = jwtUtil.generateToken(userId.toString(), newWorkspaceId);

        // 3. 결과 반환
        return ResponseEntity.ok(Map.of(
                "message", joinedWs.getName() + " 팀 합류에 성공했습니다!",
                "access_token", newToken,
                "workspace_id", newWorkspaceId
        ));
    }

    // 💡 [Phase 3] 리액트 사이드바에 띄울 내 방 목록 조회 API
    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getUserWorkspaces(@PathVariable String userId) {
        // 서비스에서 방 목록을 가져옵니다.
        java.util.List<Workspace> workspaces = workspaceService.getWorkspacesByUser(UUID.fromString(userId));

        // 리액트가 읽기 편하게 꼭 필요한 정보(ID, 이름, 초대코드)만 포장합니다.
        java.util.List<Map<String, String>> result = workspaces.stream()
                .map(ws -> Map.of(
                        "id", ws.getId().toString(),
                        "name", ws.getName(),
                        "inviteCode", ws.getInviteCode()
                )).toList();

        return ResponseEntity.ok(result);
    }
}