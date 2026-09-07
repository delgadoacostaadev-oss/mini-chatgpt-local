'use client';
import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function ChatPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uploadedFileText, setUploadedFileText] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [showLoginWarning, setShowLoginWarning] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (t) {
      setToken(t);
      fetchChats(t);
    }
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const fetchChats = async (t: string) => {
    const res = await fetch('http://127.0.0.1:8000/chats', {
      headers: { Authorization: `Bearer ${t}` }
    });
    if (res.ok) {
      const allChats = await res.json();
      // Filtrar chats vacíos (donde el título sigue siendo el predeterminado)
      setChats(allChats.filter((c: any) => c.titulo !== "Nuevo Chat"));
    }
    else if (res.status === 401) {
        localStorage.removeItem('token');
        setToken(null);
    }
  };

  const loadChat = async (chatId: number) => {
    setCurrentChatId(chatId);
    setUploadedFileText(null);
    setUploadedFileName(null);
    if (!token) return;
    const res = await fetch(`http://127.0.0.1:8000/chats/${chatId}/mensajes`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setMessages(await res.json());
  };

  const startNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setUploadedFileText(null);
    setUploadedFileName(null);
  };

  const handleDeleteChat = async (e: React.MouseEvent, chatId: number) => {
    e.stopPropagation();
    if (!token) return;
    if (confirm("¿Estás seguro de que deseas eliminar este chat?")) {
      await fetch(`http://127.0.0.1:8000/chats/${chatId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (currentChatId === chatId) {
        startNewChat();
      }
      fetchChats(token);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setChats([]);
    setMessages([]);
    setCurrentChatId(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch('http://127.0.0.1:8000/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setUploadedFileText(data.content);
        setUploadedFileName(data.filename);
      } else {
        alert("Error al procesar el archivo. Asegúrate que sea .csv, .xlsx o .pdf");
      }
    } catch (err) {
      console.error(err);
    }
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    if (!token) {
      setShowLoginWarning(true);
      return;
    }

    let targetChatId = currentChatId;
    
    if (!targetChatId) {
      const res = await fetch('http://127.0.0.1:8000/chats', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const newChat = await res.json();
        targetChatId = newChat.id;
        setCurrentChatId(newChat.id);
      } else {
        return;
      }
    }

    let payload: any = { 
      chat_id: targetChatId, 
      mensaje: inputMessage,
      web_search: false 
    };
    let visualUserMessage = inputMessage;

    if (uploadedFileText && uploadedFileName) {
      payload.contexto = uploadedFileText;
      payload.mensaje = `[ARCHIVO: ${uploadedFileName}]\n${inputMessage}`;
      visualUserMessage = payload.mensaje;
    }

    setInputMessage('');
    setUploadedFileText(null);
    setUploadedFileName(null);
    
    setMessages(prev => [...prev, { role: 'user', content: visualUserMessage }]);
    setIsTyping(true);

    try {
      const res = await fetch('http://127.0.0.1:8000/chat/stream', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });

      if (!res.body) throw new Error("No body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let aiContent = "";
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        
        for (let line of lines) {
            if (line.startsWith('data: ')) {
                const data = JSON.parse(line.substring(6));
                if (data.token) {
                    aiContent += data.token;
                    setMessages(prev => {
                        const newMsgs = [...prev];
                        newMsgs[newMsgs.length - 1].content = aiContent;
                        return newMsgs;
                    });
                }
            }
        }
      }
      setIsTyping(false);
      fetchChats(token); 
    } catch (err) {
      console.error(err);
      setIsTyping(false);
    }
  };



  return (
    <div className="flex h-screen bg-[#0f172a] text-gray-100 font-sans overflow-hidden selection:bg-indigo-500/30">
      
      {/* Sidebar */}
      <div className="w-72 bg-white/5 backdrop-blur-2xl border-r border-white/10 flex flex-col h-full z-20 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative transition-all duration-300">
        <div className="p-4 bg-gradient-to-b from-black/20 to-transparent">
          <button 
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            <span className="font-semibold">Nuevo Chat</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scrollbar-hide">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between px-2 py-2 text-xs font-semibold text-gray-400 hover:text-white uppercase tracking-wider transition-colors"
          >
            <span>Historial de Chats</span>
            <svg className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
          
          {showHistory && (
            <div className="space-y-1 mt-2 animate-fade-in-up">
              {chats.length === 0 ? (
                <div className="text-xs text-gray-600 px-2 py-4 text-center">No hay chats recientes</div>
              ) : (
                chats.map(chat => (
                  <div key={chat.id} className="relative group flex items-center">
                    <button 
                      onClick={() => loadChat(chat.id)}
                      className={`w-full text-left p-3 pr-10 rounded-xl truncate text-sm transition-all duration-300 hover:scale-[1.02] flex items-center gap-3 border ${currentChatId === chat.id ? 'bg-indigo-500/30 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/20' : 'border-transparent text-gray-400 hover:bg-white/10 hover:text-gray-100 hover:shadow-md'}`}
                    >
                      <svg className={`w-4 h-4 flex-shrink-0 ${currentChatId === chat.id ? 'text-indigo-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                      {chat.titulo}
                    </button>
                    <button 
                      onClick={(e) => handleDeleteChat(e, chat.id)}
                      className="absolute right-2 p-1.5 text-gray-500 hover:text-red-400 hover:bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      title="Eliminar chat"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        
        <div className="p-4 bg-gradient-to-t from-black/40 to-transparent">
          <button 
            onClick={handleLogout} 
            className="w-full p-3 rounded-xl hover:bg-white/10 transition-colors text-sm text-gray-400 flex items-center gap-3 border border-transparent hover:border-white/5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col h-full relative items-center justify-center">
        
        {/* Profile Button Top Right */}
        <div className="absolute top-4 right-6 z-50">
          {token ? (
            <div className="flex items-center gap-4">
              <button onClick={() => setShowHistory(!showHistory)} className="md:hidden flex items-center p-2 rounded-full bg-white/5 hover:bg-white/10 transition-all text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
              </button>
              <button onClick={handleLogout} className="flex items-center gap-2 p-2 px-4 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md transition-all text-sm font-medium text-gray-300 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                Cerrar Sesión
              </button>
            </div>
          ) : (
            <button onClick={() => setShowLoginWarning(true)} className="flex items-center gap-2 p-2 px-4 rounded-full bg-white/5 hover:bg-indigo-600/50 border border-white/10 hover:border-indigo-500/50 backdrop-blur-md shadow-lg transition-all text-sm font-semibold text-gray-200">
               <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
               Perfil
            </button>
          )}
        </div>

        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-500/10 blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />

        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.xlsx,.xls,.pdf" className="hidden" />

        {!currentChatId ? (
          <div className="w-full max-w-3xl px-6 flex flex-col items-center justify-center -mt-10 animate-fade-in-up">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-500 to-purple-500 mb-8 shadow-2xl shadow-indigo-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
            </div>
            <h2 className="text-4xl text-white font-bold mb-10 tracking-tight text-center">¿En qué te puedo ayudar hoy?</h2>
            
            <div className="w-full relative z-20">
              <form onSubmit={sendMessage} className="relative shadow-2xl group flex flex-col w-full">
                {uploadedFileName && (
                  <div className="mb-3 self-start ml-2 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs px-4 py-2 rounded-full flex items-center gap-2 backdrop-blur-md shadow-lg transition-all animate-fade-in-up">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                     <span className="font-medium truncate max-w-[200px]">{uploadedFileName}</span>
                     <button type="button" onClick={() => {setUploadedFileText(null); setUploadedFileName(null);}} className="text-gray-400 hover:text-white ml-2 hover:bg-white/10 rounded-full p-0.5 transition-colors">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                     </button>
                  </div>
                )}
                
                <div className="relative w-full">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl blur-md opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                  <div className="relative flex items-center bg-[#1e293b] border border-gray-600/50 rounded-3xl p-1.5 shadow-2xl transition-all focus-within:border-indigo-500/70 focus-within:ring-2 focus-within:ring-indigo-500/20 hover:border-gray-500/50">
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3 text-gray-400 hover:text-indigo-400 hover:bg-white/5 rounded-2xl transition-all"
                      title="Adjuntar archivo CSV, Excel o PDF"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                    </button>
                    
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Envía un mensaje a Mini ChatGPT Pro..."
                      className="flex-1 bg-transparent text-gray-100 py-3 px-2 focus:outline-none placeholder-gray-500 text-[15px]"
                      disabled={isTyping}
                    />
                    
                    <button 
                      type="submit" 
                      disabled={!inputMessage.trim() || isTyping}
                      className="bg-white text-black p-3 mr-1 rounded-2xl disabled:opacity-20 hover:bg-indigo-50 hover:scale-105 hover:-rotate-3 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                  </div>
                </div>
              </form>
              <div className="text-center text-xs text-gray-500 mt-4 opacity-80">
                Mini ChatGPT puede cometer errores. Ollama 0.5b (CSV, Excel & PDF support).
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full flex-1 flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 z-10 scrollbar-hide w-full max-w-4xl mx-auto">
              {messages.map((msg, idx) => {
                let displayContent = msg.content;
                let attachedFile = null;
                let usedWebSearch = false;
                
                if (msg.role === 'user' && displayContent.startsWith('[WEB SEARCH] ')) {
                  usedWebSearch = true;
                  displayContent = displayContent.substring(13);
                }

                if (msg.role === 'user' && displayContent.startsWith('[ARCHIVO: ')) {
                  const endIdx = displayContent.indexOf(']\n');
                  if (endIdx !== -1) {
                    attachedFile = displayContent.substring(10, endIdx);
                    displayContent = displayContent.substring(endIdx + 2);
                  }
                }

                return (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {usedWebSearch && (
                    <div className="mb-2 bg-[#1e293b] border border-blue-500/30 text-blue-300 text-xs px-4 py-2 rounded-2xl flex items-center gap-2 shadow-lg max-w-[80%]">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
                      <span className="font-medium truncate">Búsqueda Web</span>
                    </div>
                  )}
                  {attachedFile && (
                    <div className="mb-2 bg-[#1e293b] border border-indigo-500/30 text-indigo-300 text-xs px-4 py-2 rounded-2xl flex items-center gap-2 shadow-lg max-w-[80%]">
                      <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                      <span className="font-medium truncate">{attachedFile}</span>
                    </div>
                  )}
                  <div className="flex w-full justify-start" style={{ justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg mr-3 flex-shrink-0 mt-1">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl p-4 shadow-2xl transition-all duration-300 ${msg.role === 'user' ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-tr-sm border border-indigo-400/30' : 'bg-white/10 backdrop-blur-xl border border-white/20 text-gray-100 rounded-tl-sm'}`}>
                      <div className="whitespace-pre-wrap leading-relaxed">{displayContent}</div>
                    </div>
                  </div>
                </div>
              )})}
              
              {isTyping && messages.length > 0 && messages[messages.length-1].role === 'user' && (
                <div className="flex justify-start animate-fade-in-up">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg mr-3 mt-1">
                     <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl rounded-tl-sm p-4 flex gap-1 items-center shadow-xl">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>

            <div className="p-4 md:p-6 w-full max-w-4xl mx-auto relative z-20 mt-auto">
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/90 to-transparent pointer-events-none -top-10" />
              
              <form onSubmit={sendMessage} className="relative shadow-2xl group flex flex-col">
                {uploadedFileName && (
                  <div className="absolute -top-12 left-4 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs px-4 py-2 rounded-full flex items-center gap-2 backdrop-blur-md shadow-lg transition-all animate-fade-in-up">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                     <span className="font-medium truncate max-w-[200px]">{uploadedFileName}</span>
                     <button type="button" onClick={() => {setUploadedFileText(null); setUploadedFileName(null);}} className="text-gray-400 hover:text-white ml-2 hover:bg-white/10 rounded-full p-0.5 transition-colors">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                     </button>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl blur-md opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                
                <div className="relative flex items-center bg-[#1e293b] border border-gray-600/50 rounded-3xl p-1.5 shadow-2xl transition-all duration-300 focus-within:border-indigo-500/70 focus-within:ring-4 focus-within:ring-indigo-500/30 focus-within:shadow-[0_0_30px_rgba(99,102,241,0.2)] hover:border-gray-400/50">
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 text-gray-400 hover:text-indigo-400 hover:bg-white/5 rounded-2xl transition-all"
                    title="Adjuntar archivo CSV, Excel o PDF"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                  </button>
                  
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Envía un mensaje a Mini ChatGPT Pro..."
                    className="flex-1 bg-transparent text-gray-100 py-3 px-2 focus:outline-none placeholder-gray-500 text-[15px]"
                    disabled={isTyping}
                  />
                  
                  <button 
                    type="submit" 
                    disabled={!inputMessage.trim() || isTyping}
                    className="bg-white text-black p-3 mr-1 rounded-2xl disabled:opacity-20 hover:bg-indigo-50 hover:scale-105 hover:-rotate-3 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                  </button>
                </div>
              </form>
              <div className="text-center text-xs text-gray-500 mt-4 relative z-20">
                Mini ChatGPT puede cometer errores. Ollama 0.5b (CSV, Excel & PDF support).
              </div>
            </div>
          </div>
        )}
      </div>

      {showLoginWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-transparent animate-fade-in-up pointer-events-auto">
          <div className="bg-[#1e293b] border border-indigo-500/30 p-8 rounded-[2rem] shadow-2xl shadow-indigo-500/10 max-w-md w-full text-center mx-4 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
             <div className="w-20 h-20 mx-auto bg-indigo-500/10 rounded-full flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
             </div>
             <h3 className="text-2xl font-bold text-white mb-3">¡Inicia Sesión!</h3>
             <p className="text-gray-400 mb-8 leading-relaxed text-sm">Para poder chatear y guardar tu historial con la IA, necesitas iniciar sesión o registrarte gratis.</p>
             <div className="flex gap-4 w-full">
               <button onClick={() => setShowLoginWarning(false)} className="flex-1 py-3 px-4 bg-transparent border border-gray-600 hover:border-gray-400 text-gray-300 rounded-2xl hover:bg-white/5 transition-all font-semibold">
                 Cancelar
               </button>
               <button onClick={() => router.push('/login')} className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-500/25 transition-all font-semibold flex items-center justify-center gap-2">
                 <span>Ir a Login</span>
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
