package com.dativus.server.controller;

import com.dativus.server.service.DocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.dativus.server.dto.WebhookRequest;

@RestController
@RequestMapping("/api/v1/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadDocument(
            // 💡 프론트엔드가 보낸 출입증(토큰)을 잡아냅니다!
            @RequestHeader(value = "Authorization", required = false) String token,
            @RequestParam("file") MultipartFile file,
            @RequestParam("workspaceId") String workspaceId
    ) {
        try {
            // 💡 잡은 출입증(token)을 우체부(Service)에게 같이 쥐여 보냅니다.
            String fastApiResponse = documentService.sendToFastAPI(file, workspaceId, token);
            return ResponseEntity.ok().body(fastApiResponse);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("파일 업로드/전송 실패: " + e.getMessage());
        }
    }

    @PostMapping("/webhook")
    public ResponseEntity<?> handleFastApiWebhook(@RequestBody WebhookRequest request) {
        try {
            documentService.updateDocumentStatus(request.getDocumentId(), request.getStatus());
            return ResponseEntity.ok().body("상태 업데이트 완료 접수!");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("상태 업데이트 실패: " + e.getMessage());
        }
    }

    // 💡 [안전하게 개조됨] 지식망 보드에 띄울 문서 목록 요청 창구 (GET)
    @GetMapping("/workspace/{workspaceId}")
    public ResponseEntity<?> getWorkspaceDocuments (@PathVariable String workspaceId) {
        try {
            java.util.List<com.dativus.server.entity.UploadedDocument> docs = documentService.getDocumentsByWorkspace(workspaceId);

            // 깐깐한 Map.of 대신 어떤 예외 상황에도 안 터지는 안전한 HashMap 사용!
            java.util.List<java.util.Map<String, Object>> result = new java.util.ArrayList<>();
            for (com.dativus.server.entity.UploadedDocument doc : docs) {
                java.util.Map<String, Object> map = new java.util.HashMap<>();
                map.put("id", doc.getId().toString());
                map.put("fileName", doc.getFileName() != null ? doc.getFileName() : "이름 없음");
                map.put("status", doc.getVectorStatus() != null ? doc.getVectorStatus() : "PENDING");
                result.add(map);
            }
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("문서 목록을 불러오는 데 실패했습니다.");
        }
    }

    // 💡 [신규 추가] 쓰레기통 버튼을 눌렀을 때의 삭제 창구 (DELETE)
    @DeleteMapping("/{documentId}")
    public ResponseEntity<?> deleteDocument(@PathVariable String documentId) {
        try {
            documentService.deleteDocument(documentId);
            return ResponseEntity.ok(java.util.Map.of("message", "문서가 성공적으로 삭제되었습니다."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("문서 삭제 실패");
        }
    }
}