export default function DocManagerModal({ docList, onDelete, onClose }) {
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
        maxHeight: '80vh',
      }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#111' }}>팀 지식망 현황</div>
            <div style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>업로드된 문서 목록</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '20px',
            cursor: 'pointer', color: '#aaa', lineHeight: 1, padding: '4px',
          }}>✕</button>
        </div>

        {/* 목록 */}
        <div className="chat-scroll" style={{ overflowY: 'auto', flex: 1 }}>
          {docList.length === 0 ? (
            <div style={{
              padding: '60px 0', textAlign: 'center',
              color: '#bbb', fontSize: '14px',
            }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>📭</div>
              업로드된 지식이 없습니다.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                  <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: '700', color: '#888', textAlign: 'left' }}>문서명</th>
                  <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: '700', color: '#888', textAlign: 'left' }}>학습 상태</th>
                  <th style={{ padding: '10px 12px', width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {docList.map(doc => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#111', fontWeight: '500' }}>
                      {doc.fileName.endsWith('.pdf') ? '📄 ' : '📝 '}{doc.fileName}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                        backgroundColor: doc.status === 'DONE' ? '#111' : '#f0f0f0',
                        color: doc.status === 'DONE' ? '#fff' : '#888',
                      }}>
                        {doc.status === 'DONE' ? '학습 완료' : '처리 중...'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        onClick={() => onDelete(doc.id)}
                        onMouseEnter={e => e.currentTarget.style.color = '#e53e3e'}
                        onMouseLeave={e => e.currentTarget.style.color = '#aaa'}
                        style={{
                          background: 'none', border: 'none',
                          cursor: 'pointer', fontSize: '16px', color: '#aaa',
                          transition: 'color 0.15s', padding: '4px',
                        }}
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 하단 */}
        <div style={{ flexShrink: 0 }}>
          <button onClick={onClose} style={{
            width: '100%', padding: '12px',
            border: '1.5px solid #e0e0e0', borderRadius: '8px',
            cursor: 'pointer', backgroundColor: '#fff',
            fontWeight: '600', fontSize: '14px', color: '#555',
          }}>
            닫기
          </button>
        </div>

      </div>
    </div>
  );
}
