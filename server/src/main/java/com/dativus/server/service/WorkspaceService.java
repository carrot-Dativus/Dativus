package com.dativus.server.service;

import com.dativus.server.entity.ChatSession;
import com.dativus.server.entity.User;
import com.dativus.server.entity.Workspace;
import com.dativus.server.entity.WorkspaceMember;
import com.dativus.server.repository.ChatSessionRepository;
import com.dativus.server.repository.UserRepository;
import com.dativus.server.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WorkspaceService {

    private final WorkspaceRepository workspaceRepository;
    private final UserRepository userRepository;
    private final ChatSessionRepository chatSessionRepository;

    // 1. 팀 생성 및 랜덤 초대코드 발급
    @Transactional
    public Workspace createWorkspace(String name) {
        String inviteCode = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        Workspace workspace = new Workspace(name, inviteCode);
        Workspace saved = workspaceRepository.save(workspace);

        // 워크스페이스 생성 시 # 일반 채널 자동 생성
        ChatSession defaultChannel = new ChatSession();
        defaultChannel.setWorkspace(saved);
        defaultChannel.setTitle("일반");
        defaultChannel.setSessionType("TEAM_CHANNEL");
        chatSessionRepository.save(defaultChannel);

        return saved;
    }

    // 2. 초대코드를 이용한 팀 합류
    @Transactional
    public Workspace joinWorkspace(UUID userId, String inviteCode) { // 👈 반환 타입을 Workspace로!
        User user = userRepository.findById(userId).orElseThrow();
        Workspace workspace = workspaceRepository.findByInviteCode(inviteCode)
                .orElseThrow(() -> new RuntimeException("잘못된 초대 코드입니다."));

        // 이미 입장권이 있는지 확인 (중복 입장 방지)
        boolean alreadyMember = user.getWorkspaceMembers().stream()
                .anyMatch(m -> m.getWorkspace().getId().equals(workspace.getId()));

        if (!alreadyMember) {
            // 💡 새 입장권 발급 및 연결
            WorkspaceMember member = new WorkspaceMember(user, workspace, "MEMBER");
            user.getWorkspaceMembers().add(member);
            // Cascade 설정 덕분에 user만 저장해도 입장권이 생성됩니다.
        }

        return workspace; // 👈 컨트롤러에게 방 정보를 돌려줍니다.
    }

    @Transactional(readOnly = true)
    public java.util.List<Workspace> getWorkspacesByUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));

        // 유저의 입장권(WorkspaceMember) 목록에서 방(Workspace) 객체만 추출하여 리스트로 만듭니다.
        return user.getWorkspaceMembers().stream()
                .map(WorkspaceMember::getWorkspace)
                .toList();
    }
}