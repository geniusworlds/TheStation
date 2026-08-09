/**
 * TheStation - Saudi Arabic Text-to-Speech Engine
 * Leverages Web Speech API (speechSynthesis) for free, instant, 100% legal Arabic/Saudi TTS synthesis, audio history, and script linking.
 */

class TTSEngine {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.voices = [];
    this.isSpeaking = false;
    this.currentUtterance = null;
    this.audioHistory = [];

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadVoices();

    if (this.synth) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  bindEvents() {
    const textInput = document.getElementById('tts-text-input');
    if (textInput) {
      textInput.addEventListener('input', () => this.updateTextStats());
    }

    const generateBtn = document.getElementById('tts-generate-btn');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => this.generateAndPlaySpeech());
    }

    const stopBtn = document.getElementById('tts-stop-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stopSpeech());
    }

    const clearBtn = document.getElementById('tts-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (textInput) textInput.value = '';
        this.updateTextStats();
      });
    }

    const pasteBtn = document.getElementById('tts-paste-btn');
    if (pasteBtn) {
      pasteBtn.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (textInput) {
            textInput.value = text;
            this.updateTextStats();
          }
        } catch (e) {
          if (window.showToast) window.showToast('يرجى السماح بالوصول للحافظة', 'warning');
        }
      });
    }

    const linkScriptBtn = document.getElementById('tts-link-script-btn');
    if (linkScriptBtn) {
      linkScriptBtn.addEventListener('click', () => this.linkAudioToScriptModal());
    }
  }

  loadVoices() {
    if (!this.synth) return;

    this.voices = this.synth.getVoices();
    const voiceSelect = document.getElementById('tts-voice-select');
    if (!voiceSelect) return;

    // Filter Arabic voices
    const arabicVoices = this.voices.filter(v => v.lang.startsWith('ar') || v.name.toLowerCase().includes('arabic'));

    voiceSelect.innerHTML = '';

    if (arabicVoices.length > 0) {
      arabicVoices.forEach((voice, index) => {
        const isSaudi = voice.lang.includes('SA') || voice.name.toLowerCase().includes('saudi');
        const dialectLabel = isSaudi ? '🇸🇦 صوت سعودي (نجدي/حجازي)' : `🇸🇦 صوت عربي (${voice.lang})`;
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = `${voice.name} - ${dialectLabel}`;
        voiceSelect.appendChild(option);
      });
    } else {
      // Default browser voice fallback
      const option = document.createElement('option');
      option.value = 'default_arabic';
      option.textContent = '🇸🇦 صوت سعودي افتراضي (المحرك المدمج)';
      voiceSelect.appendChild(option);
    }
  }

  updateTextStats() {
    const textInput = document.getElementById('tts-text-input');
    if (!textInput) return;

    const text = textInput.value;
    const charCount = text.length;
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

    const charCounterEl = document.getElementById('tts-char-count');
    const wordCounterEl = document.getElementById('tts-word-count');

    if (charCounterEl) charCounterEl.textContent = `${charCount} / 2000 حرف`;
    if (wordCounterEl) wordCounterEl.textContent = `${wordCount} كلمة`;
  }

  async generateAndPlaySpeech() {
    const textInput = document.getElementById('tts-text-input');
    const text = textInput ? textInput.value.trim() : '';

    if (!text) {
      if (window.showToast) window.showToast('يرجى كتابة النص المراد تحويله إلى صوت', 'warning');
      return;
    }

    const voiceSelect = document.getElementById('tts-voice-select');
    const speedSelect = document.getElementById('tts-speed-select');
    const pitchSelect = document.getElementById('tts-pitch-select');

    const selectedVoiceName = voiceSelect ? voiceSelect.value : '';
    const speed = speedSelect ? parseFloat(speedSelect.value) : 1.0;
    const pitch = pitchSelect ? parseFloat(pitchSelect.value) : 1.0;

    if (!this.synth) {
      if (window.showToast) window.showToast('تحويل النص إلى صوت غير مدعوم في هذا المتصفح', 'danger');
      return;
    }

    this.stopSpeech();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    utterance.rate = speed;
    utterance.pitch = pitch;

    if (selectedVoiceName && selectedVoiceName !== 'default_arabic') {
      const selectedVoice = this.voices.find(v => v.name === selectedVoiceName);
      if (selectedVoice) utterance.voice = selectedVoice;
    }

    // Waveform & UI updates
    const playerCard = document.getElementById('tts-player-card');
    const waveformEl = document.getElementById('tts-waveform');
    const playerStatusEl = document.getElementById('tts-player-status');

    if (playerCard) playerCard.style.display = 'block';
    if (waveformEl) waveformEl.classList.add('playing');
    if (playerStatusEl) playerStatusEl.textContent = 'جاري القراءة الصوتية باللكنة السعودية...';

    utterance.onend = async () => {
      this.isSpeaking = false;
      if (waveformEl) waveformEl.classList.remove('playing');
      if (playerStatusEl) playerStatusEl.textContent = 'اكتملت القراءة الصوتية ✓';

      // Save to history
      const historyItem = {
        textPreview: text.length > 80 ? text.substring(0, 80) + '...' : text,
        fullText: text,
        voice: selectedVoiceName || 'صوت سعودي',
        dialect: '🇸🇦 سعودي عام',
        duration: `${Math.ceil(text.length / 15)} ثانية`
      };

      if (window.stationDB) {
        await window.stationDB.saveTTSHistory(historyItem);
        this.renderTTSHistory();
      }
    };

    utterance.onerror = (e) => {
      console.error('Speech error:', e);
      this.isSpeaking = false;
      if (waveformEl) waveformEl.classList.remove('playing');
      if (playerStatusEl) playerStatusEl.textContent = 'حدث خطأ أثناء تشغيل الصوت.';
    };

    this.currentUtterance = utterance;
    this.isSpeaking = true;
    this.synth.speak(utterance);

    if (window.showToast) window.showToast('جاري توليد وتشغيل الصوت السعودي...', 'info');
  }

  stopSpeech() {
    if (this.synth) {
      this.synth.cancel();
      this.isSpeaking = false;
      const waveformEl = document.getElementById('tts-waveform');
      const playerStatusEl = document.getElementById('tts-player-status');
      if (waveformEl) waveformEl.classList.remove('playing');
      if (playerStatusEl) playerStatusEl.textContent = 'تم إيقاف التشغيل.';
    }
  }

  async renderTTSHistory() {
    const container = document.getElementById('tts-history-container');
    if (!container || !window.stationDB) return;

    const history = await window.stationDB.getTTSHistory(10);
    if (history.length === 0) {
      container.innerHTML = `
        <div class="empty-state card">
          <div class="empty-icon">🎙️</div>
          <h3>لا يوجد سجل تحويلات صوتية بعد</h3>
          <p>أدخل النص واضغط "إنشاء الصوت" لبدء توليد مقاطع صوتية.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = history.map(item => `
      <div class="tts-history-card card">
        <div class="tts-history-header">
          <span class="badge badge-dialect">${item.dialect || '🇸🇦 سعودي'}</span>
          <span class="tts-history-date">${item.timestamp ? new Date(item.timestamp).toLocaleDateString('ar-SA') : ''}</span>
        </div>
        <p class="tts-history-text">"${this.escapeHTML(item.textPreview)}"</p>
        <div class="tts-history-actions">
          <button class="btn btn-sm btn-primary" onclick="window.ttsEngine.playFromHistory('${this.escapeHTML(item.fullText.replace(/'/g, "\\'"))}')">
            ▶ إعادة التشغيل
          </button>
          <button class="btn btn-sm btn-secondary" onclick="window.ttsEngine.copyHistoryText('${this.escapeHTML(item.fullText.replace(/'/g, "\\'"))}')">
            📋 نسخ النص
          </button>
          <button class="btn btn-sm btn-danger-ghost" onclick="window.ttsEngine.deleteHistoryItem('${item.id}')">
            🗑️
          </button>
        </div>
      </div>
    `).join('');
  }

  playFromHistory(text) {
    const textInput = document.getElementById('tts-text-input');
    if (textInput) {
      textInput.value = text;
      this.updateTextStats();
    }
    this.generateAndPlaySpeech();
  }

  copyHistoryText(text) {
    navigator.clipboard.writeText(text).then(() => {
      if (window.showToast) window.showToast('تم نسخ النص إلى الحافظة', 'success');
    });
  }

  async deleteHistoryItem(id) {
    if (window.stationDB) {
      await window.stationDB.deleteTTSHistory(id);
      this.renderTTSHistory();
      if (window.showToast) window.showToast('تم حذف العنصر من السجل', 'info');
    }
  }

  async linkAudioToScriptModal() {
    const textInput = document.getElementById('tts-text-input');
    const text = textInput ? textInput.value.trim() : '';

    if (!text) {
      if (window.showToast) window.showToast('يرجى توليد نص صوتي أولاً لربطه بسكربت', 'warning');
      return;
    }

    const scripts = await window.stationDB.getAllScripts();
    if (scripts.length === 0) {
      if (window.showToast) window.showToast('لا يوجد سكربتات متاحة للربط بها', 'warning');
      return;
    }

    const scriptSelectHTML = scripts.map(s => `<option value="${s.id}">${this.escapeHTML(s.title)}</option>`).join('');

    const modalHTML = `
      <div class="modal-backdrop" id="tts-link-modal">
        <div class="modal-content card">
          <h3>🎙️ ربط التعليق الصوتي بسكربت</h3>
          <p>اختر السكربت الذي تريد إضافة الملاحظة الصوتية إليه:</p>
          <div class="form-group">
            <select id="tts-select-script-target" class="form-control">
              ${scriptSelectHTML}
            </select>
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary" onclick="window.ttsEngine.confirmLinkAudio()">تأكيد الربط</button>
            <button class="btn btn-secondary" onclick="document.getElementById('tts-link-modal').remove()">إلغاء</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  async confirmLinkAudio() {
    const select = document.getElementById('tts-select-script-target');
    const textInput = document.getElementById('tts-text-input');
    if (!select || !textInput) return;

    const scriptId = select.value;
    const text = textInput.value;

    const script = await window.stationDB.getScriptById(scriptId);
    if (script) {
      script.content += `<hr /><p>🎙️ <strong>تعليق صوتي مرتبط:</strong> "${this.escapeHTML(text)}"</p>`;
      await window.stationDB.saveScript(script);
      document.getElementById('tts-link-modal').remove();
      if (window.showToast) window.showToast(`تم ربط التعليق الصوتي بسكربت "${script.title}" بنجاح!`, 'success');
    }
  }

  escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}

window.ttsEngine = new TTSEngine();
