package com.dativus.server.service;

import com.dativus.server.dto.UserRegisterRequest;
import com.dativus.server.entity.User;
import com.dativus.server.entity.Workspace;
import com.dativus.server.entity.WorkspaceMember; // 💡 신규 입장권 엔티티 임포트!
import com.dativus.server.repository.UserRepository;
import com.dativus.server.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import java.util.UUID;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    @Transactional
    public String register(UserRegisterRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("이미 존재하는 이메일입니다.");
        }

        String encodedPassword = passwordEncoder.encode(request.getPassword());

        // 💡 [변경 1] 유저를 먼저 단독으로 생성합니다. (방 연결 없음!)
        User user = new User(
                request.getUsername(),
                request.getEmail(),
                encodedPassword
        );

        if (request.getPersona() != null) {
            user.updatePersona(
                    request.getPersona().getDecisionStyle(),
                    request.getPersona().getExpertise(),
                    request.getPersona().getTone(),
                    request.getPersona().getPersonaMemo()
            );
        }

        // 💡 [중요] 유저를 먼저 DB에 저장하여 ID를 확보합니다.
        userRepository.save(user);

        // 💡 [변경 2] 개인 샌드박스 방을 단독으로 생성합니다.
        String inviteCode = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        Workspace personalWorkspace = new Workspace(request.getUsername() + "의 샌드박스", inviteCode);

        // 샌드박스 방 DB에 저장
        workspaceRepository.save(personalWorkspace);

        // 💡 [변경 3 - 핵심 타격] 입장권을 발급하여 유저와 방을 연결합니다!
        // 유저, 방, 그리고 권한("OWNER")을 넣어 입장권을 만듭니다.
        WorkspaceMember ticket = new WorkspaceMember(user, personalWorkspace, "OWNER");

        // 유저의 주머니에 입장권을 넣어줍니다.
        // (User 엔티티에 cascade = CascadeType.ALL이 걸려있으므로, 입장권도 자동으로 DB에 저장됩니다!)
        user.getWorkspaceMembers().add(ticket);

        return "회원가입 성공! 개인 샌드박스가 발급되었습니다. (User ID: " + user.getId() + ")";
    }

    @Transactional
    public void updateUserPersona(String userIdStr, String decisionStyle, String expertise, String tone, String personaMemo) {
        UUID userId = UUID.fromString(userIdStr);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));

        user.updatePersona(decisionStyle, expertise, tone, personaMemo);
    }

    @Transactional(readOnly = true)
    public java.util.Map<String, String> getUserProfile(String userIdStr) {
        UUID userId = UUID.fromString(userIdStr);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));

        java.util.Map<String, String> profile = new java.util.HashMap<>();
        profile.put("email", user.getEmail());
        profile.put("username", user.getUsername());
        profile.put("decisionStyle", user.getPersonaDecisionStyle() != null ? user.getPersonaDecisionStyle() : "일반적인");
        profile.put("expertise", user.getPersonaExpertise() != null ? user.getPersonaExpertise() : "기본");
        profile.put("tone", user.getPersonaTone() != null ? user.getPersonaTone() : "친절한");
        profile.put("personaMemo", user.getPersonaMemo() != null ? user.getPersonaMemo() : "");
        return profile;
    }
}