const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// Элементы DOM
const modelEl = $('#model');
const promptEl = $('#prompt');
const messagesContainer = $('#messagesContainer');
const sendBtn = $('#sendBtn');
const voiceBtn = $('#voiceBtn');
const attachBtn = $('#attachBtn');
const settingsBtn = $('#settingsBtn');
const themeBtn = $('#themeBtn');
const mobileMenuBtn = $('#mobileMenuBtn');
const sidebar = $('#sidebar');
const closeSidebar = $('#closeSidebar');
const clearHistoryBtn = $('#clearHistoryBtn');
const historyList = $('#historyList');
const modalOverlay = $('#modalOverlay');
const modalClose = $('#modalClose');
const modalBody = $('#modalBody');
const charCount = $('.char-count');
const quickActions = $$('.quick-action');
const menuOverlay = $('#menuOverlay');
const messagesContainerEl = $('.messages-container');
const inputContainer = $('.input-container');

// Состояние приложения
let isRecording = false;
let isDarkTheme = true;
let messages = [];
let isMenuOpen = false;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  setupEventListeners();
  loadHistory();
  checkTheme();
});

function initializeApp() {
  // Настройка textarea для авто-изменения высоты
  promptEl.addEventListener('input', () => {
    promptEl.style.height = 'auto';
    promptEl.style.height = Math.min(promptEl.scrollHeight, 120) + 'px';
    updateCharCount();
  });

  // Загрузка сохраненных сообщений
  loadMessages();
}

function setupEventListeners() {
  // Отправка сообщения
  sendBtn.addEventListener('click', sendMessage);
  promptEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Голосовой ввод
  voiceBtn.addEventListener('click', toggleVoiceRecording);

  // Прикрепление файлов
  attachBtn.addEventListener('click', () => {
    showModal('📎 Прикрепление файлов', 'Функция прикрепления файлов будет доступна в следующем обновлении.');
  });

  // Мобильное меню
  mobileMenuBtn.addEventListener('click', openMobileMenu);
  closeSidebar.addEventListener('click', closeMobileMenu);
  menuOverlay.addEventListener('click', closeMobileMenu);

  // Настройки (только для десктопа)
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      sidebar.classList.add('active');
    });
  }

  // Закрытие сайдбара при клике вне его (только на десктопе)
  document.addEventListener('click', (e) => {
    if (window.innerWidth > 768 && 
        !sidebar.contains(e.target) && 
        !settingsBtn?.contains(e.target) && 
        !mobileMenuBtn.contains(e.target)) {
      sidebar.classList.remove('active');
    }
  });

  // Тема
  themeBtn.addEventListener('click', toggleTheme);

  // История
  clearHistoryBtn.addEventListener('click', clearHistory);

  // Модальное окно
  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay && !menuOverlay.classList.contains('active')) {
      closeModal();
    }
  });

  // Быстрые действия
  quickActions.forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-text');
      promptEl.value = text;
      promptEl.focus();
      updateCharCount();
    });
  });

  // Обработка изменения размера окна
  window.addEventListener('resize', handleResize);
}

function openMobileMenu() {
  isMenuOpen = true;
  sidebar.classList.add('active');
  menuOverlay.classList.add('active');
  
  // Добавляем класс для сдвига контента
  messagesContainerEl.classList.add('menu-open');
  inputContainer.classList.add('menu-open');
  
  // Блокируем скролл основного контента
  document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
  isMenuOpen = false;
  sidebar.classList.remove('active');
  menuOverlay.classList.remove('active');
  
  // Убираем класс для сдвига контента
  messagesContainerEl.classList.remove('menu-open');
  inputContainer.classList.remove('menu-open');
  
  // Разблокируем скролл
  document.body.style.overflow = '';
}

function handleResize() {
  // Если окно стало больше мобильного, закрываем мобильное меню
  if (window.innerWidth > 768 && isMenuOpen) {
    closeMobileMenu();
  }
}

function updateCharCount() {
  const length = promptEl.value.length;
  charCount.textContent = `${length} / 4000`;
  
  if (length > 3800) {
    charCount.style.color = 'var(--warn)';
  } else if (length > 4000) {
    charCount.style.color = 'var(--danger)';
    promptEl.value = promptEl.value.substring(0, 4000);
  } else {
    charCount.style.color = 'var(--muted)';
  }
}

async function sendMessage() {
  const prompt = promptEl.value.trim();

  if (!prompt) {
    shakeElement(promptEl);
    return;
  }

  // Закрываем мобильное меню если открыто
  if (isMenuOpen) {
    closeMobileMenu();
  }

  // Скрыть приветственное сообщение
  const welcomeMessage = $('.welcome-message');
  if (welcomeMessage) {
    welcomeMessage.style.display = 'none';
  }

  // Добавить сообщение пользователя
  addMessage(prompt, 'user');
  
  // Очистить поле ввода
  promptEl.value = '';
  promptEl.style.height = 'auto';
  updateCharCount();

  // Показать индикатор набора текста
  showTypingIndicator();

  // Отключить кнопку отправки на время запроса
  sendBtn.disabled = true;
  sendBtn.querySelector('.send-spinner').classList.remove('hidden');

  try {
    console.log('Отправка запроса на бэкенд...');
    console.log('Модель:', modelEl.value);
    console.log('Промпт:', prompt);
    
    const response = await fetch('/create/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelEl.value,
        prompt: prompt
      })
    });

    console.log('Статус ответа:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ошибка ответа сервера:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('Полученные данные:', data);
    
    const message = data.message || 'Извините, произошла ошибка. Попробуйте еще раз.';
    
    // Удалить индикатор набора текста
    removeTypingIndicator();
    
    // Добавить ответ AI
    addMessage(message, 'ai');
    
    // Сохранить в историю
    saveToHistory(prompt, message);
    
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    removeTypingIndicator();
    addMessage(`Ошибка: ${error.message}. Проверьте подключение к интернету и попробуйте еще раз.`, 'ai', true);
  } finally {
    // Включить кнопку отправки
    sendBtn.disabled = false;
    sendBtn.querySelector('.send-spinner').classList.add('hidden');
  }
}

function addMessage(text, sender, isError = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;
  
  // Используем локальное фото для аватаров
  const avatar = sender === 'user' 
    ? 'photo/avatarka.jpg'
    : 'photo/avatarka.jpg';
  
  const time = new Date().toLocaleTimeString('ru-RU', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  messageDiv.innerHTML = `
    <img src="${avatar}" alt="${sender}" class="message-avatar">
    <div class="message-content ${isError ? 'error' : ''}">
      <div class="message-text">${escapeHtml(text)}</div>
      <div class="message-time">${time}</div>
    </div>
  `;
  
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Добавить в массив сообщений
  messages.push({ text, sender, time, isError });
}

function showTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message ai typing-indicator';
  typingDiv.innerHTML = `
    <img src="photo/avatarka.jpg" alt="AI" class="message-avatar">
    <div class="message-content">
      <div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;
  messagesContainer.appendChild(typingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingIndicator() {
  const typingIndicator = $('.typing-indicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function toggleVoiceRecording() {
  if (!isRecording) {
    startVoiceRecording();
  } else {
    stopVoiceRecording();
  }
}

function startVoiceRecording() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showModal('🎤 Голосовой ввод', 'Ваш браузер не поддерживает голосовой ввод');
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  
  recognition.lang = 'ru-RU';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isRecording = true;
    voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
    voiceBtn.style.color = 'var(--danger)';
    voiceBtn.classList.add('recording');
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    promptEl.value = transcript;
    updateCharCount();
    promptEl.focus();
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    showModal('🎤 Ошибка распознавания', 'Не удалось распознать речь. Попробуйте еще раз.');
    stopVoiceRecording();
  };

  recognition.onend = () => {
    stopVoiceRecording();
  };

  recognition.start();
}

function stopVoiceRecording() {
  isRecording = false;
  voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
  voiceBtn.style.color = 'var(--muted)';
  voiceBtn.classList.remove('recording');
}

function toggleTheme() {
  isDarkTheme = !isDarkTheme;
  document.body.classList.toggle('light-theme');
  
  const icon = themeBtn.querySelector('i');
  icon.className = isDarkTheme ? 'fas fa-moon' : 'fas fa-sun';
  
  localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
}

function checkTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    isDarkTheme = false;
    document.body.classList.add('light-theme');
    themeBtn.querySelector('i').className = 'fas fa-sun';
  }
}

function saveToHistory(prompt, response) {
  const historyItem = {
    prompt,
    response,
    model: modelEl.value,
    timestamp: Date.now()
  };
  
  let history = JSON.parse(localStorage.getItem('qwen_history') || '[]');
  history.unshift(historyItem);
  history = history.slice(0, 50); // Хранить только последние 50 сообщений
  
  localStorage.setItem('qwen_history', JSON.stringify(history));
  renderHistory();
}

function loadHistory() {
  renderHistory();
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem('qwen_history') || '[]');
  
  if (history.length === 0) {
    historyList.innerHTML = '<div class="no-history">История пуста</div>';
    return;
  }
  
  historyList.innerHTML = history.map((item, index) => `
    <div class="history-item" data-index="${index}">
      <div class="history-time">${formatDate(item.timestamp)}</div>
      <div class="history-prompt">${escapeHtml(item.prompt.substring(0, 100))}${item.prompt.length > 100 ? '...' : ''}</div>
      <div class="history-model">${item.model.split('/')[1] || item.model}</div>
    </div>
  `).join('');
  
  // Добавить обработчики кликов на элементы истории
  $$('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.getAttribute('data-index'));
      const historyItem = JSON.parse(localStorage.getItem('qwen_history') || '[]')[index];
      
      if (historyItem) {
        promptEl.value = historyItem.prompt;
        updateCharCount();
        
        // Закрываем мобильное меню если открыто
        if (isMenuOpen) {
          closeMobileMenu();
        }
        
        promptEl.focus();
      }
    });
  });
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Только что';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} д назад`;
  
  return date.toLocaleDateString('ru-RU');
}

function clearHistory() {
  if (confirm('Вы уверены, что хотите очистить всю историю чатов?')) {
    localStorage.removeItem('qwen_history');
    renderHistory();
    showModal('✅ История очищена', 'Вся история чатов была успешно удалена.');
  }
}

function loadMessages() {
  // Можно добавить загрузку последних сообщений из localStorage
}

function showModal(title, content) {
  modalBody.innerHTML = `
    <h3>${title}</h3>
    <p>${content}</p>
  `;
  modalOverlay.classList.add('active');
}

function closeModal() {
  modalOverlay.classList.remove('active');
}

function shakeElement(element) {
  element.style.animation = 'shake 0.5s';
  setTimeout(() => {
    element.style.animation = '';
  }, 500);
}

// Добавить CSS анимации
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
  
  .typing-dots {
    display: flex;
    gap: 4px;
    padding: 8px 0;
  }
  
  .typing-dots span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--muted);
    animation: typing 1.4s infinite ease-in-out;
  }
  
  .typing-dots span:nth-child(1) { animation-delay: -0.32s; }
  .typing-dots span:nth-child(2) { animation-delay: -0.16s; }
  
  @keyframes typing {
    0%, 80%, 100% {
      transform: scale(0.8);
      opacity: 0.5;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  .voice-btn.recording {
    animation: pulse 1.5s infinite;
  }
  
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(255, 69, 58, 0.7);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(255, 69, 58, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(255, 69, 58, 0);
    }
  }
  
  .message-content.error {
    background: rgba(255, 69, 58, 0.1);
    border-color: rgba(255, 69, 58, 0.3);
  }
  
  .no-history {
    text-align: center;
    color: var(--muted);
    padding: 20px;
    font-style: italic;
  }
  
  .history-time {
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 4px;
  }
  
  .history-prompt {
    font-weight: 500;
    margin-bottom: 4px;
    line-height: 1.3;
  }
  
  .history-model {
    font-size: 10px;
    color: var(--accent);
    background: rgba(108, 140, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-block;
  }
  
  .send-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-left: 8px;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;
document.head.appendChild(shakeStyle);