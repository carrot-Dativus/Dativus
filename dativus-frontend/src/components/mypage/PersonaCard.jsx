const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: '1px solid #e0e0e0', fontSize: '13px', outline: 'none',
  backgroundColor: '#fafafa', boxSizing: 'border-box',
};

const selectStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: '1px solid #e0e0e0', fontSize: '13px', outline: 'none',
  backgroundColor: '#fff', cursor: 'pointer',
};

const fieldLabelStyle = {
  fontSize: '12px', fontWeight: '600', color: '#666',
  marginBottom: '6px', display: 'block',
};

export default function PersonaCard({
  email, username,
  decisionStyle, setDecisionStyle,
  expertise, setExpertise,
  tone, setTone,
  personaMemo, setPersonaMemo,
  onSave,
}) {
  const initial = username?.[0]?.toUpperCase() || '?';

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #ebebeb' }}>

      {/* 상단: 프로필 + 이메일 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px', paddingBottom: '28px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%', flexShrink: 0,
          backgroundColor: '#111', color: '#fff',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontSize: '28px', fontWeight: '700',
        }}>
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#111' }}>{username} 지휘관</div>
          <div style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>{email}</div>
        </div>
      </div>

      {/* 페르소나 설정 */}
      <div style={{ fontSize: '15px', fontWeight: '700', color: '#111', marginBottom: '20px' }}>AI 어시스턴트 페르소나</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div>
          <label style={fieldLabelStyle}>판단 스타일</label>
          <select value={decisionStyle} onChange={(e) => setDecisionStyle(e.target.value)} style={selectStyle}>
            <option value="일반적인">일반적인 (A/B/C 구조)</option>
            <option value="간단하게">간단하게 (요약+핵심만)</option>
            <option value="창의적인">창의적인 (test)</option>
          </select>
        </div>
        <div>
          <label style={fieldLabelStyle}>전문 분야</label>
          <select value={expertise} onChange={(e) => setExpertise(e.target.value)} style={selectStyle}>
            <option value="기본">기본 (제너럴리스트)</option>
            <option value="프론트엔드">프론트엔드 (UI/UX)</option>
            <option value="백엔드">백엔드 (서버/DB)</option>
            <option value="데이터 엔지니어">데이터 엔지니어</option>
          </select>
        </div>
        <div>
          <label style={fieldLabelStyle}>대화 어조</label>
          <select value={tone} onChange={(e) => setTone(e.target.value)} style={selectStyle}>
            <option value="친절한">친절한 (기본)</option>
            <option value="단호하고 전문적인">전문적인 (딱딱함)</option>
            <option value="사극 이순신 장군">이순신 장군 (사극 톤)</option>
          </select>
        </div>
      </div>

      {/* 고정 구조 안내 */}
      <div style={{
        backgroundColor: '#f8f8f8', borderRadius: '8px', padding: '12px 14px',
        marginBottom: '16px', border: '1px solid #ebebeb',
      }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#555', marginBottom: '6px' }}>
          항상 유지되는 답변 구조
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['A / B / C 선택지', '요약', '넥스트 스텝'].map((tag) => (
            <span key={tag} style={{
              fontSize: '11px', padding: '3px 8px', borderRadius: '20px',
              backgroundColor: '#111', color: '#fff', fontWeight: '600',
            }}>{tag}</span>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={fieldLabelStyle}>
          추가 지시사항{' '}
          <span style={{ fontWeight: '400', color: '#bbb' }}>— 말투·설명 깊이 등 스타일만 조정됩니다 (선택)</span>
        </label>
        {/* 경고: 구조 변경 지시는 무시됨 */}
        <div style={{
          fontSize: '11px', color: '#e07b00', marginBottom: '6px',
          padding: '6px 10px', backgroundColor: '#fff8f0', borderRadius: '6px',
          border: '1px solid #fde8c8',
        }}>
          ⚠ 위 고정 구조를 없애거나 바꾸는 지시는 적용되지 않습니다.
        </div>
        <textarea
          value={personaMemo}
          onChange={(e) => setPersonaMemo(e.target.value)}
          placeholder={"예) 기초 설명은 생략하고 핵심만 짧게 답해줘.\n예) 답변을 항상 영어로 해줘.\n예) 모든 답변 끝에 한 줄 요약을 붙여줘."}
          style={{
            ...inputStyle, minHeight: '80px', resize: 'vertical',
            fontFamily: 'inherit', lineHeight: '1.6',
          }}
        />
      </div>

      <button
        onClick={onSave}
        style={{
          width: '100%', padding: '12px', backgroundColor: '#111', color: '#fff',
          border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '14px',
          cursor: 'pointer',
        }}
      >
        성향 동기화 (저장)
      </button>

    </div>
  );
}
