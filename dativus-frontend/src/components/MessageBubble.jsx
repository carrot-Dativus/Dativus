import { memo, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

export function TraceStepperBubble({ trace }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhase(p => (p + 1) % 3), 400);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ padding: '12px 5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#555',
            opacity: phase === i ? 1 : 0.2, transition: 'opacity 0.25s ease',
          }} />
        ))}
      </div>
      <div style={{ fontSize: '13px', color: '#777', fontStyle: 'italic', maxWidth: '360px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {trace || '요원들을 소집하는 중...'}
      </div>
    </div>
  );
}

const MessageBubble = memo(({ msg, prevMsg, handleShareToTeam, handleFeedback, isPrivate, isLastMsg, isStreaming, currentTrace }) => {
  const cleanMessageText = (text, isUser = false) => {
    if (!text) return '';
    let cleaned = text;
    if (isUser) {
      cleaned = cleaned.replace(/^\[skip\]\s*/g, '');
      cleaned = cleaned.replace(/\s*\[추가 정보:\s*([^\]]+)\]/g, '\n→ $1');
      return cleaned.trim();
    }
    cleaned = cleaned.replace(/(?:^|\n)``(\w*)\n([\s\S]*?)``(?=\n|$)/g, (_, lang, code) => '\n```' + lang + '\n' + code + '```');
    const codeBlocks = [];
    cleaned = cleaned.replace(/```[\s\S]*?```/g, m => { codeBlocks.push(m); return `\x00CODE${codeBlocks.length - 1}\x00`; });
    cleaned = cleaned.replace(/\*\*json:(?:DASHBOARD|CANVAS)[\s\S]*?\*\*/gi, '');
    const marker = String.fromCharCode(96, 96, 96);
    cleaned = cleaned.replace(new RegExp(marker + "(?:json:DASHBOARD|json:CANVAS|json)?[\\s\\S]*?({[\\s\\S]*?})[\\s\\S]*?" + marker, 'gi'), '');
    cleaned = cleaned.replace(/\*\*DASHBOARD\*\*/gi, '').replace(/DASHBOARD/gi, '');
    cleaned = cleaned.replace(/([가-힣])\.\s*(?=[가-힣a-zA-Z0-9*])/g, '$1.\n\n');
    cleaned = cleaned.replace(/([a-zA-Z])\.\s+(?=[가-힣A-Z*])/g, '$1.\n\n');
    cleaned = cleaned.replace(/(?=\*\*?A안|\*\*?B안|\*\*?C안)/g, '\n\n');
    cleaned = cleaned.replace(/(?=\*\*장점|\*\*단점)/g, '\n\n');
    cleaned = cleaned.replace(/([^\n])\n(#{1,4} )/g, '$1\n\n$2');
    cleaned = cleaned.replace(/([^\n])\n([-*] )/g, '$1\n\n$2');
    cleaned = cleaned.replace(/\n\s*\n+/g, '\n\n');
    cleaned = cleaned.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeBlocks[parseInt(i)]);
    // LLM이 > 기호를 빠뜨렸을 때 blockquote 자동 보정 (이미 > 있으면 스킵)
    cleaned = cleaned.replace(/^(?!>)\*?\*?요약:?\*?\*?\s*(.+)/gm, '> **요약:** $1');
    cleaned = cleaned.replace(/^(?!>)(⚠️\s*\*?\*?주의:?\*?\*?\s*.+)/gm, '> $1');
    cleaned = cleaned.replace(/^(?!>)(마음에 드는 방안.+설계해.+)/gm, '> $1');
    cleaned = cleaned.replace(/^(?!>)(적용 후.+알려주세요.?)/gm, '> $1');
    cleaned = cleaned.replace(/^([^\n]*\|[^\n]*)$/gm, row => {
      let r = row.trim();
      if (!r.startsWith('|')) r = '| ' + r;
      if (!r.endsWith('|')) r = r + ' |';
      return r;
    });
    cleaned = cleaned.replace(/(^\|[^\n]+\|\n)(^\|[\s|:-]+\|)$/gm, (_, header) => {
      const colCount = (header.match(/\|/g) || []).length - 1;
      return header + '| ' + Array(colCount).fill('---').join(' | ') + ' |';
    });
    return cleaned.trim();
  };

  const isCustomAgent = msg.sender === 'custom_agent';
  const myName = localStorage.getItem('username') || '나';
  const isMyMessage = msg.sender === 'user' && (!msg.senderName || msg.senderName === myName);
  const isOtherUser = msg.sender === 'user' && !isMyMessage;
  const senderLabel = msg.sender === 'user'
    ? (msg.senderName && msg.senderName !== myName ? msg.senderName : (isPrivate ? `${myName} (비밀)` : myName))
    : isCustomAgent ? msg.agentName
    : (isPrivate ? 'AI 어시스턴트 (비밀)' : 'AI 어시스턴트');

  return (
    <div style={{ alignSelf: isMyMessage ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textAlign: isMyMessage ? 'right' : 'left' }}>
        {senderLabel}
      </div>
      <div style={{
        backgroundColor: isMyMessage ? '#000' : isOtherUser ? '#f0f0f0' : isCustomAgent ? '#f0fdf4' : 'transparent',
        color: isMyMessage ? '#fff' : '#333',
        padding: isMyMessage ? '12px 18px' : (isOtherUser || isCustomAgent) ? '12px 16px' : '12px 5px',
        border: isCustomAgent ? '1px solid #86efac' : 'none',
        borderRadius: '12px', lineHeight: '1.6',
      }}>
        {(msg.sender === 'ai' || isCustomAgent) && isLastMsg && isStreaming && msg.text === ''
          ? <TraceStepperBubble trace={currentTrace} />
          : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={{
                h1: ({children}) => <p style={{fontWeight:'700',fontSize:'15px',margin:'10px 0 4px',color:'#111'}}>{children}</p>,
                h2: ({children}) => <p style={{fontWeight:'700',fontSize:'14px',margin:'8px 0 4px',color:'#111'}}>{children}</p>,
                h3: ({children}) => <p style={{fontWeight:'700',fontSize:'13px',margin:'6px 0 4px',color:'#222'}}>{children}</p>,
                h4: ({children}) => <p style={{fontWeight:'700',fontSize:'13px',margin:'4px 0 2px',color:'#333'}}>{children}</p>,
                p: ({children}) => <p style={{margin:'3px 0',lineHeight:'1.7'}}>{children}</p>,
                blockquote: ({children}) => {
                  const text = typeof children === 'string' ? children
                    : Array.isArray(children) ? children.map(c => (typeof c === 'string' ? c : c?.props?.children ?? '')).join('') : '';
                  const isCA = text.includes('💡');
                  return (
                    <blockquote style={{
                      borderLeft: `3px solid ${isCA ? '#22c55e' : '#3b82f6'}`,
                      backgroundColor: isCA ? '#f0fdf4' : '#f0f7ff',
                      margin:'8px 0', padding:'6px 12px', borderRadius:'0 6px 6px 0',
                      color: isCA ? '#15803d' : '#1e40af',
                    }}>{children}</blockquote>
                  );
                },
                pre: ({children}) => <>{children}</>,
                code: ({className, children}) => {
                  const language = (className || '').replace('language-', '') || 'text';
                  const codeStr = String(children || '').replace(/\n$/, '');
                  const isBlock = className || codeStr.includes('\n');
                  if (isBlock) return (
                    <SyntaxHighlighter language={language} style={atomOneDark}
                      customStyle={{borderRadius:'8px',fontSize:'13px',margin:'8px 0',lineHeight:'1.6',padding:'14px 16px',whiteSpace:'pre',overflowX:'auto'}}
                      codeTagProps={{style:{background:'transparent',whiteSpace:'pre',fontFamily:"'Consolas','D2Coding',monospace"}}}
                      PreTag={({children,...r}) => <pre {...r} style={{...r.style,whiteSpace:'pre',margin:0}}>{children}</pre>}
                      showLineNumbers={codeStr.split('\n').length > 5}
                      wrapLongLines={false}
                    >{codeStr}</SyntaxHighlighter>
                  );
                  return <code style={{backgroundColor:'#f0f0f0',padding:'2px 5px',borderRadius:'3px',fontSize:'13px',fontFamily:"'Consolas','D2Coding',monospace",color:'#d63384'}}>{children}</code>;
                },
                a: ({href,children}) => <a href={href} target="_blank" rel="noopener noreferrer" style={{color:'#2196f3',textDecoration:'underline'}}>{children}</a>,
                ul: ({children}) => <ul style={{paddingLeft:'20px',margin:'4px 0'}}>{children}</ul>,
                ol: ({children}) => <ol style={{paddingLeft:'20px',margin:'4px 0'}}>{children}</ol>,
                li: ({children}) => <li style={{marginBottom:'2px',lineHeight:'1.6'}}>{children}</li>,
                hr: () => <hr style={{border:'none',borderTop:'1px solid #e0e0e0',margin:'12px 0'}} />,
                table: ({children}) => <div style={{overflowX:'auto',margin:'10px 0'}}><table style={{borderCollapse:'collapse',width:'100%',fontSize:'13px'}}>{children}</table></div>,
                th: ({children}) => <th style={{border:'1px solid #ddd',padding:'6px 12px',backgroundColor:'#f5f5f5',textAlign:'left',fontWeight:'600',whiteSpace:'nowrap'}}>{children}</th>,
                td: ({children}) => <td style={{border:'1px solid #ddd',padding:'6px 12px',verticalAlign:'top'}}>{children}</td>,
                tr: ({children}) => <tr style={{borderBottom:'1px solid #eee'}}>{children}</tr>,
              }}
            >
              {cleanMessageText(msg.text, msg.sender === 'user')}
            </ReactMarkdown>
          )
        }
      </div>
      {msg.sender === 'ai' && !isCustomAgent && (
        <div style={{ display: 'flex', justifyContent: isPrivate ? 'space-between' : 'flex-end', alignItems: 'center', marginTop: '6px' }}>
          {isPrivate && (
            <button onClick={() => handleShareToTeam(msg.text)}
              style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer', backgroundColor: '#111', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
              팀 워크스페이스로 대화 공유
            </button>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => handleFeedback(true, prevMsg?.text, msg.text, msg, isPrivate)} style={{ background:'transparent', border:'1px solid #4CAF50', cursor:'pointer', borderRadius:'4px', padding:'2px 8px', fontSize:'12px', color:'#4CAF50' }}>좋아요</button>
            <button onClick={() => handleFeedback(false, prevMsg?.text, msg.text, msg, isPrivate)} style={{ background:'transparent', border:'1px solid #F44336', cursor:'pointer', borderRadius:'4px', padding:'2px 8px', fontSize:'12px', color:'#F44336' }}>별로요</button>
          </div>
        </div>
      )}
    </div>
  );
});

export default MessageBubble;
