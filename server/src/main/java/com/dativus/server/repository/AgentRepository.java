package com.dativus.server.repository;

import com.dativus.server.entity.Agent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface AgentRepository extends JpaRepository<Agent, UUID> {
    // 💡 [핵심] "이 주인이 만든 자아들을 전부 데려와!" 라는 전용 레이더
    List<Agent> findByOwnerId(UUID ownerId);
}