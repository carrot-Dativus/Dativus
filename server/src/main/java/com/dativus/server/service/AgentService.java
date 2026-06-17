package com.dativus.server.service;

import com.dativus.server.entity.Agent;
import com.dativus.server.entity.User;
import com.dativus.server.repository.AgentRepository;
import com.dativus.server.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AgentService {
    private final AgentRepository agentRepository;
    private final UserRepository userRepository;

    // 💡 1. 새로운 자아를 빚어내는 로직
    @Transactional
    public Agent createAgent(String ownerIdStr, String name, String description, String agentType, Double threshold) {
        User owner = userRepository.findById(UUID.fromString(ownerIdStr))
                .orElseThrow(() -> new RuntimeException("지휘관(유저)을 찾을 수 없습니다."));

        Agent agent = new Agent();
        agent.setOwner(owner);
        agent.setName(name);
        agent.setDescription(description);
        agent.setAgentType(agentType);
        agent.setModelName("llama3");
        agent.setIsActive(true);
        agent.setThreshold(threshold != null ? threshold : 0.38);

        return agentRepository.save(agent);
    }

    // 💡 2. 내가 만든 자아 목록 불러오기 로직
    @Transactional(readOnly = true)
    public List<Agent> getAgentsByOwner(String ownerIdStr) {
        return agentRepository.findByOwnerId(UUID.fromString(ownerIdStr));
    }

    // 💡 3. 자아 수정
    @Transactional
    public Agent updateAgent(String agentIdStr, String name, String description, String agentType, Double threshold) {
        Agent agent = agentRepository.findById(UUID.fromString(agentIdStr))
                .orElseThrow(() -> new RuntimeException("에이전트를 찾을 수 없습니다."));
        agent.setName(name);
        agent.setDescription(description);
        agent.setAgentType(agentType);
        if (threshold != null) agent.setThreshold(threshold);
        return agentRepository.save(agent);
    }

    // 💡 4. 자아 삭제
    @Transactional
    public void deleteAgent(String agentIdStr) {
        UUID agentId = UUID.fromString(agentIdStr);
        if (!agentRepository.existsById(agentId)) {
            throw new RuntimeException("에이전트를 찾을 수 없습니다.");
        }
        agentRepository.deleteById(agentId);
    }
}