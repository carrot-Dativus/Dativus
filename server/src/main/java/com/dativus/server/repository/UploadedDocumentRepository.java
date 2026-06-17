package com.dativus.server.repository;

import com.dativus.server.entity.UploadedDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface UploadedDocumentRepository extends JpaRepository<UploadedDocument, UUID> {
    // 💡 [핵심] 우리 팀 방에 올라간 문서들만 싹 찾아오는 레이더
    List<UploadedDocument> findByWorkspaceId(UUID workspaceId);
}