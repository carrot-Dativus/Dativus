package com.dativus.server.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class LoginResponse {
    private String access_token;
    private String refresh_token;
    private String token_type;
    private String user_id;
    private String workspace_id;
    private String username;
}