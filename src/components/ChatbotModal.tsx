import React, { useState, useRef, useEffect } from 'react';
import { useCalendar } from '../context/CalendarContext';
import { translations } from '../data/i18n';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Bot,
  User,
  Heart,
  Calendar,
  Clock,
  Loader2,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

interface ChatbotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatbotModal: React.FC<ChatbotModalProps> = ({ isOpen, onClose }) => {
  const { language } = useCalendar();
  const t = translations[language];

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text:
        language === 'zh'
          ? '您好！我是阿嬷日程小助手。您可以问我：\n• 某一天阿嬷住在谁家（家超、家源、家文）\n• 俊杰的上下班排班时间\n• 新加坡公共假期安排'
          : "Hello! I'm your Ahma's Rotation assistant. Ask me anything about where Ahma is staying (Kay Cheow, Kay Guan, Kay Boon), Jun Jie's work shift, or upcoming Singapore public holidays!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (messageToSend?: string) => {
    const text = (messageToSend || input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, language }),
      });

      if (res.ok) {
        const data = await res.json();
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: data.reply || (language === 'zh' ? '暂未获取到答案，请稍后再试。' : 'No reply received.'),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        throw new Error('API failed');
      }
    } catch (e) {
      const errorMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        sender: 'bot',
        text:
          language === 'zh'
            ? '抱歉，服务暂时繁忙，请稍后再试。'
            : 'Sorry, could not connect to assistant right now. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-2xs">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl h-[88vh] sm:h-[620px] shadow-2xl border-2 border-zinc-300 flex flex-col justify-between overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-rose-600 via-rose-700 to-amber-600 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base leading-tight">
                {t.chatbotTitle}
              </h3>
              <p className="text-3xs sm:text-2xs text-rose-100">
                {t.chatbotSubtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-rose-100 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-zinc-50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2 ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender === 'bot' && (
                <div className="w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs shrink-0 mt-0.5">
                  <Heart className="w-3.5 h-3.5 fill-current" />
                </div>
              )}

              <div
                className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.sender === 'user'
                    ? 'bg-rose-600 text-white rounded-br-xs font-semibold'
                    : 'bg-white text-zinc-900 border border-zinc-200 shadow-2xs rounded-bl-xs font-medium'
                }`}
              >
                {msg.text}
                <div
                  className={`text-3xs mt-1 text-right ${
                    msg.sender === 'user' ? 'text-rose-200' : 'text-zinc-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {msg.sender === 'user' && (
                <div className="w-7 h-7 rounded-full bg-zinc-800 text-white flex items-center justify-center text-xs shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-zinc-500 text-xs pl-2">
              <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
              <span>{t.thinking}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-2.5 bg-zinc-100/90 border-t border-zinc-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {t.quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="px-2.5 py-1 rounded-full text-3xs sm:text-2xs font-bold bg-white hover:bg-rose-50 text-zinc-800 hover:text-rose-700 border border-zinc-300 shrink-0 transition-colors shadow-2xs"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 bg-white border-t border-zinc-200 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            placeholder={t.askPlaceholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 px-3.5 py-2 border-2 border-zinc-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-rose-500 shadow-2xs"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-zinc-300 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <span>{t.send}</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
