package com.dativus.server.service;

import com.dativus.server.entity.UploadedDocument;
import com.dativus.server.entity.Workspace;
import com.dativus.server.repository.UploadedDocumentRepository;
import com.dativus.server.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DocumentService {

    @Value("${fastapi.base.url:http://127.0.0.1:8000}")
    private String fastapiBaseUrl;

    private final RestTemplate restTemplate = new RestTemplate();
    private final UploadedDocumentRepository uploadedDocumentRepository;

    // 💡 [핵심 추가] 워크스페이스(방) 정보를 찾아오기 위한 탐지기 추가
    private final WorkspaceRepository workspaceRepository;

    @Transactional
    public String sendToFastAPI(MultipartFile file, String workspaceId, String token) throws IOException {

        // 💡 [핵심 개조 1] 파이썬으로 쏘기 전에, 스프링 DB에 "🟡처리 중" 상태로 먼저 기록을 남깁니다!
        Workspace workspace = workspaceRepository.findById(UUID.fromString(workspaceId))
                .orElseThrow(() -> new IllegalArgumentException("워크스페이스를 찾을 수 없습니다."));

        UploadedDocument document = new UploadedDocument();
        document.setWorkspace(workspace);
        document.setFileName(file.getOriginalFilename());
        document.setFilePath("FastAPI_Processing"); // 임시 경로
        document.setFileSize(file.getSize());
        document.setVectorStatus("PENDING"); // 🟡 처리 중 상태로 저장!

        // DB에 저장하고 새롭게 발급된 문서 고유 ID를 확보합니다.
        UploadedDocument savedDoc = uploadedDocumentRepository.save(document);

        // ---------------------------------------------------------
        // 파이썬 FastAPI 로 발송
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new ByteArrayResource(file.getBytes()) {
            @Override
            public String getFilename() {
                return file.getOriginalFilename();
            }
        });
        body.add("workspace_id", workspaceId);

        // 💡 [핵심 개조 2] 나중에 파이썬이 작업 끝나고 "이 문서 완료!"(웹훅)를 칠 수 있도록, 문서 ID를 같이 보냅니다.
        body.add("document_id", savedDoc.getId().toString());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        if (token != null) {
            headers.set("Authorization", token);
        }

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        ResponseEntity<String> response = restTemplate.postForEntity(
                fastapiBaseUrl + "/api/v1/documents/upload",
                requestEntity,
                String.class
        );

        return response.getBody();
    }

    // --- (아래는 이전에 만들었던 조회/삭제/웹훅 메서드들입니다) ---

    @Transactional
    public void updateDocumentStatus(String documentId, String status) {
        UploadedDocument document = uploadedDocumentRepository.findById(UUID.fromString(documentId))
                .orElseThrow(() -> new IllegalArgumentException("해당 문서를 찾을 수 없습니다: " + documentId));
        document.setVectorStatus(status);
        System.out.println("✅ [Webhook 수신] 문서(" + document.getFileName() + ")의 AI 분석 상태가 " + status + "로 변경되었습니다!");
    }

    public java.util.List<UploadedDocument> getDocumentsByWorkspace(String workspaceId) {
        return uploadedDocumentRepository.findByWorkspaceId(UUID.fromString(workspaceId));
    }

    // 💡 [개조 완료] 문서 삭제 및 AI 뇌세포(벡터) 동시 삭제 작전
    @Transactional
    public void deleteDocument(String documentId) {
        // 1. 무작정 지우지 않고, 삭제할 문서의 정보(이름, 방 번호)를 DB에서 먼저 찾습니다.
        UploadedDocument doc = uploadedDocumentRepository.findById(UUID.fromString(documentId))
                .orElseThrow(() -> new IllegalArgumentException("해당 문서를 찾을 수 없습니다: " + documentId));

        String workspaceId = doc.getWorkspace().getId().toString();
        String fileName = doc.getFileName();

        // 2. 파이썬 서버로 "이 파일의 기억을 지워라!" 라고 무전을 칩니다. (DELETE 통신)
        String fastApiDeleteUrl = fastapiBaseUrl + "/api/v1/documents?workspace_id=" + workspaceId + "&file_name=" + fileName;
        try {
            restTemplate.delete(fastApiDeleteUrl);
            System.out.println("🔥 [파이썬 뇌 삭제 통신 성공] " + fileName + "의 벡터 기억 소각 명령 하달!");
        } catch (Exception e) {
            System.out.println("🚨 파이썬 뇌 삭제 통신 실패: " + e.getMessage());
        }

        // 3. 마지막으로 스프링 DB에서도 깔끔하게 기록을 지웁니다.
        uploadedDocumentRepository.delete(doc);
        System.out.println("🗑️ [스프링 DB 문서 삭제 완료] Document ID: " + documentId);
    }
}