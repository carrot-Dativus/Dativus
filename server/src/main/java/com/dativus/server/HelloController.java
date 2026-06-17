package com.dativus.server; // 본인 패키지 경로에 맞게 수정

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloController {
//(Port 8080)
    @GetMapping("/api/hello")
    public String hello() {
        return "Dativus 지휘관 서버가 정상 작동 중입니다!";
    }
}