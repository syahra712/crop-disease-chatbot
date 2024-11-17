import React, { useState, useEffect } from "react";
import { FaSun, FaMoon } from "react-icons/fa";
import { useSpring, animated } from "react-spring";
import './App.css';

// Message formatting component
const MessageContent = ({ content }) => {
  const formatMessage = (text) => {
    // Handle multiline text first
    const lines = text.split('\n');
    return lines.map((line, lineIndex) => {
      // Split the line into parts based on formatting
      const parts = [];
      let currentText = '';
      let index = 0;

      while (index < line.length) {
        // Handle bold text (**text** or ***text***)
        if (line.slice(index).startsWith('***') || line.slice(index).startsWith('**')) {
          const isBold = line.slice(index).startsWith('***') ? 3 : 2;
          const endIndex = line.indexOf('*'.repeat(isBold), index + isBold);
          
          if (endIndex !== -1) {
            if (currentText) parts.push({ type: 'text', content: currentText });
            currentText = '';
            
            parts.push({
              type: 'bold',
              content: line.slice(index + isBold, endIndex)
            });
            
            index = endIndex + isBold;
            continue;
          }
        }
        currentText += line[index];
        index++;
      }

      if (currentText) parts.push({ type: 'text', content: currentText });

      return (
        <div key={lineIndex} className="message-line">
          {parts.map((part, partIndex) => (
            part.type === 'bold' ? 
              <strong key={partIndex}>{part.content}</strong> : 
              <span key={partIndex}>{part.content}</span>
          ))}
        </div>
      );
    });
  };

  return <div className="message-content">{formatMessage(content)}</div>;
};

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [theme, setTheme] = useState("light");
  const [isTyping, setIsTyping] = useState(false);

  const typingStyle = useSpring({
    opacity: isTyping ? 1 : 0,
    transform: isTyping ? "translateY(0)" : "translateY(20px)",
  });

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    
    const newMessage = { 
      role: "user", 
      text: userInput,
      timestamp: new Date().toISOString()
    };
    
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setUserInput("");
    setIsTyping(true);

    try {
      const response = await getBotResponse(userInput);
      const botMessage = { 
        role: "chatbot", 
        text: response,
        timestamp: new Date().toISOString()
      };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
    } catch (error) {
      const errorMessage = { 
        role: "chatbot", 
        text: "Sorry, I couldn't fetch a response. Please try again.",
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const getBotResponse = async (question) => {
    const response = await fetch("http://localhost:5000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    const data = await response.json();
    return data.answer;
  };

  const handleInputChange = (e) => {
    setUserInput(e.target.value);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    const chatBox = document.getElementById("chat-box");
    chatBox.scrollTo({
      top: chatBox.scrollHeight,
      behavior: 'smooth'
    });
  }, [messages]);

  return (
    <div className={`chat-container ${theme}`}>
      <header className="header">
        <h1>Crop Disease Chatbot</h1>
        <button 
          className="theme-toggle" 
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        >
          {theme === "light" ? <FaMoon /> : <FaSun />}
        </button>
      </header>

      <div id="chat-box" className="chat-box">
        {messages.map((msg, index) => (
          <div
            key={`${msg.timestamp}-${index}`}
            className={`message ${msg.role} ${msg.isError ? 'error' : ''}`}
          >
            <MessageContent content={msg.text} />
          </div>
        ))}
        <animated.div style={typingStyle}>
          {isTyping && <div className="typing">Chatbot is typing...</div>}
        </animated.div>
      </div>

      <div className="input-container">
        <input
          type="text"
          value={userInput}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Ask me about crop diseases..."
          aria-label="Message input"
        />
        <button 
          onClick={handleSendMessage}
          disabled={!userInput.trim() || isTyping}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chatbot;