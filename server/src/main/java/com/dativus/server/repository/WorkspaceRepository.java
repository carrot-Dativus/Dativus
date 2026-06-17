package com.dativus.server.repository;

import com.dativus.server.entity.Workspace;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface WorkspaceRepository extends JpaRepository<Workspace, UUID> {
    // 💡 초대 코드로 워크스페이스를 찾아내는 전용 탐지기입니다.
    Optional<Workspace> findByInviteCode(String inviteCode);
}