package com.dativus.server.controller;

import com.dativus.server.dto.UserRegisterRequest;
import com.dativus.server.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping("/register")
    public ResponseEntity<String> register(@RequestBody UserRegisterRequest request) {
        try {
            String message = userService.register(request);
            return ResponseEntity.ok(message);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 💡 [신규 추가] 마이페이지에서 호출할 페르소나 수정 API (PUT)
    @PutMapping("/{userId}/persona")
    public ResponseEntity<?> updatePersona(@PathVariable String userId, @RequestBody java.util.Map<String, String> request) {
        try {
            userService.updateUserPersona(
                    userId,
                    request.get("decisionStyle"),
                    request.get("expertise"),
                    request.get("tone"),
                    request.get("personaMemo")
            );
            // 성공하면 프론트엔드에 확인 메시지 전송
            return ResponseEntity.ok().body(java.util.Map.of("message", "AI 뇌파(페르소나) 동기화 완료!"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 💡 [신규 추가] 마이페이지 진입 시 프로필 불러오기 API (GET)
    @GetMapping("/{userId}")
    public ResponseEntity<?> getUserProfile(@PathVariable String userId) {
        try {
            return ResponseEntity.ok(userService.getUserProfile(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}