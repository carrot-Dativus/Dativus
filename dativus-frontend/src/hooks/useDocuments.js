import { useState, useEffect } from 'react';
import { apiClient } from '../api/axiosInstance';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export function useDocuments(workspaceId, isDocManagerOpen) {
  const [docList, setDocList] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const fetchDocuments = async () => {
    if (!workspaceId) return;
    try {
      const res = await apiClient.get(`/api/v1/documents/workspace/${workspaceId}`);
      if (res.ok) setDocList(await res.json());
    } catch {
      console.error('문서 목록 로드 실패');
    }
  };

  // 문서 관리 모달이 열릴 때마다 3초마다 폴링
  useEffect(() => {
    if (!isDocManagerOpen) return;
    fetchDocuments();
    const interval = setInterval(fetchDocuments, 3000);
    return () => clearInterval(interval);
  }, [isDocManagerOpen, workspaceId]);

  const handleFileUpload = async (onSuccess) => {
    if (!selectedFile) return;
    const token = localStorage.getItem('token');
    if (!token) { alert('출입증이 없습니다.'); return; }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('workspaceId', workspaceId);
    setIsUploading(true);

    try {
      // 파일 업로드는 Content-Type을 브라우저가 자동으로 multipart 설정해야 해서 fetch 직접 사용
      const response = await fetch(`${API_BASE_URL}/api/v1/documents/upload`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: formData,
      });
      if (response.ok) {
        alert('파일 접수 완료!');
        setSelectedFile(null);
        fetchDocuments();
        onSuccess?.();
      } else {
        alert('업로드 실패');
      }
    } catch (error) {
      alert(`오류: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('정말로 이 문서를 삭제하시겠습니까?')) return;
    try {
      const res = await apiClient.delete(`/api/v1/documents/${docId}`);
      if (res.ok) { alert('삭제되었습니다!'); fetchDocuments(); }
    } catch {
      alert('삭제 통신 오류!');
    }
  };

  return {
    docList,
    selectedFile, setSelectedFile,
    isUploading,
    handleFileUpload,
    handleDeleteDocument,
  };
}
