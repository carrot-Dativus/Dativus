import { useState, useRef } from 'react';

export default function UploadModal({ selectedFile, setSelectedFile, isUploading, onUpload, onClose }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.pdf') || file.name.endsWith('.txt'))) {
      setSelectedFile(file);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#111' }}>지식망 파일 추가</div>
            <div style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>PDF 또는 TXT 파일을 업로드하세요</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '20px',
            cursor: 'pointer', color: '#aaa', lineHeight: 1, padding: '4px',
          }}>✕</button>
        </div>

        {/* 드래그앤드롭 존 */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? '#111' : selectedFile ? '#111' : '#d0d0d0'}`,
            borderRadius: '12px',
            backgroundColor: isDragging ? '#f5f5f5' : selectedFile ? '#fafafa' : '#fff',
            padding: '48px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
            cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt"
            onChange={(e) => setSelectedFile(e.target.files[0])}
            style={{ display: 'none' }}
          />

          {selectedFile ? (
            <>
              <div style={{ fontSize: '40px' }}>{selectedFile.name.endsWith('.pdf') ? '📄' : '📝'}</div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#111' }}>{selectedFile.name}</div>
              <div style={{ fontSize: '12px', color: '#999' }}>{formatSize(selectedFile.size)}</div>
              <div style={{ fontSize: '12px', color: '#aaa' }}>다른 파일로 바꾸려면 클릭하거나 드래그하세요</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '40px' }}>📂</div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#111' }}>
                {isDragging ? '여기에 놓으세요' : '파일을 드래그하거나 클릭해서 선택'}
              </div>
              <div style={{ fontSize: '12px', color: '#aaa' }}>PDF, TXT 지원</div>
            </>
          )}
        </div>

        {/* 버튼 */}
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
            onClick={() => onUpload(onClose)}
            disabled={isUploading || !selectedFile}
            style={{
              flex: 2, padding: '12px',
              border: 'none', borderRadius: '8px',
              cursor: (isUploading || !selectedFile) ? 'not-allowed' : 'pointer',
              backgroundColor: (isUploading || !selectedFile) ? '#ccc' : '#000',
              color: '#fff', fontWeight: '700', fontSize: '14px',
              transition: 'background-color 0.15s',
            }}
          >
            {isUploading ? '업로드 중...' : '서버로 전송'}
          </button>
        </div>

      </div>
    </div>
  );
}
