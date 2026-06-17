export default function AgentCreateModal({ form, setForm, onSubmit, isEdit = false, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#fff', borderRadius: '16px',
        width: '560px', padding: '36px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', gap: '24px',
      }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#111' }}>
              {isEdit ? '에이전트 수정' : '새 에이전트 추가'}
            </div>
            <div style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>
              {isEdit ? '에이전트 설정을 수정하세요' : '커스텀 에이전트를 등록하세요'}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '20px',
            cursor: 'pointer', color: '#aaa', lineHeight: 1, padding: '4px',
          }}>✕</button>
        </div>

        {/* 요원 이름 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>요원 이름</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="예) 마케팅 전략가"
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
          />
        </div>

        {/* 성격 및 역할 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>성격 및 역할</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="이 에이전트의 역할과 성격을 설명하세요"
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', resize: 'none', outline: 'none', lineHeight: '1.6' }}
          />
        </div>

        {/* 구동 엔진 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>구동 엔진</label>
          <select
            value={form.agentType}
            onChange={(e) => setForm({ ...form, agentType: e.target.value })}
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', outline: 'none', backgroundColor: '#fff' }}
          >
            <option value="LOCAL">로컬 LLM</option>
            <option value="EXTERNAL_API">외부 API</option>
          </select>
        </div>

        {/* 감지 민감도 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>감지 민감도</label>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#111' }}>{(form.threshold ?? 0.38).toFixed(2)}</span>
          </div>
          <input
            type="range" min="0" max="1" step="0.01"
            value={form.threshold ?? 0.38}
            onChange={(e) => setForm({ ...form, threshold: parseFloat(e.target.value) })}
            style={{ width: '100%', accentColor: '#111', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#bbb' }}>
            <span>느슨 — 쉽게 활성화</span>
            <span>엄격 — 꼭 맞을 때만</span>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px',
            border: '1.5px solid #e0e0e0', borderRadius: '8px',
            cursor: 'pointer', backgroundColor: '#fff',
            fontWeight: '600', fontSize: '14px', color: '#555',
          }}>
            취소
          </button>
          <button
            onClick={() => onSubmit(onClose)}
            style={{
              flex: 2, padding: '12px',
              border: 'none', borderRadius: '8px',
              cursor: 'pointer', backgroundColor: '#000',
              color: '#fff', fontWeight: '700', fontSize: '14px',
            }}
          >
            {isEdit ? '수정 완료' : '에이전트 생성'}
          </button>
        </div>

      </div>
    </div>
  );
}
