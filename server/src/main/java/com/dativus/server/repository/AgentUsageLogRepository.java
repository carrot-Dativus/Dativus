package com.dativus.server.repository;

import com.dativus.server.entity.AgentUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AgentUsageLogRepository extends JpaRepository<AgentUsageLog, UUID> {

    @Query("SELECT a.agentName, COUNT(a) FROM AgentUsageLog a WHERE a.userId = :userId GROUP BY a.agentName ORDER BY COUNT(a) DESC")
    List<Object[]> countByUserIdGroupByAgentName(@Param("userId") String userId);
}
