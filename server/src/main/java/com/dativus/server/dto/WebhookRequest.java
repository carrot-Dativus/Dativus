package com.dativus.server.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class WebhookRequest {
    // 파이썬이 어떤 문서가 끝났는지, 성공했는지 실패했는지 알려줄 겁니다.
    private String documentId;
    private String status; // "DONE" 또는 "FAILED"
}