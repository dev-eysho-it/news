import { Injectable, signal, computed } from '@angular/core';
import { Speaker } from './app.component';

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private utterance: SpeechSynthesisUtterance | null = null;
  private voices = signal<SpeechSynthesisVoice[]>([]);
  private assignedVoices = new Map<string, SpeechSynthesisVoice>();
  
  readonly voicesLoaded = computed(() => this.voices().length > 0);
  currentlyPlayingId = signal<string | null>(null);

  isSpeaking = (id: string) => computed(() => this.currentlyPlayingId() === id);

  constructor() {
    this.loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
    window.addEventListener('beforeunload', () => this.stop());
  }
  
  private loadVoices(): void {
      this.voices.set(speechSynthesis.getVoices());
  }

  assignVoices(speakers: Speaker[]): void {
      const germanVoices = this.voices().filter(v => v.lang.startsWith('de-DE'));
      if (germanVoices.length === 0) {
          console.warn("No German voices found for speech synthesis.");
          return;
      }
      
      const preferredVoices: { [key: string]: string[] } = {
          'Lena': ['Anna', 'Google Deutsch'],
          'Dr. Aris Thorne': ['Markus', 'Yannick'],
          'Clara Vale': ['Petra', 'Sarah'],
          'Dr. Evelyn Reed': ['Elena', 'Tina'],
          'Marco Voss': ['Viktor', 'Felix']
      };

      const usedVoices = new Set<SpeechSynthesisVoice>();

      speakers.forEach(speaker => {
          let foundVoice: SpeechSynthesisVoice | undefined;
          const preferences = preferredVoices[speaker.name] || [];

          // Try to find a preferred voice that hasn't been used yet
          for (const pref of preferences) {
              const voice = germanVoices.find(v => v.name.includes(pref) && !usedVoices.has(v));
              if (voice) {
                  foundVoice = voice;
                  break;
              }
          }

          // If no preferred voice is found or all are used, find the first available unused voice
          if (!foundVoice) {
              foundVoice = germanVoices.find(v => !usedVoices.has(v));
          }

          // Fallback: just use any german voice if all are used (for small voice lists)
          if (foundVoice) {
              this.assignedVoices.set(speaker.name, foundVoice);
              usedVoices.add(foundVoice);
          } else if (germanVoices.length > 0) {
              this.assignedVoices.set(speaker.name, germanVoices[0]);
          }
      });
  }
  
  getVoiceForSpeaker(speakerName: string): SpeechSynthesisVoice | null {
      return this.assignedVoices.get(speakerName) || null;
  }

  toggleTTS(id: string, text: string): void {
    if (this.isSpeaking(id)()) {
      this.stop();
    } else {
      this.stop(); // Stop any other playing audio first
      this.speak(id, text, this.getVoiceForSpeaker('Lena')); // Default to moderator voice
    }
  }

  stop(): void {
    if (speechSynthesis.speaking || speechSynthesis.pending) {
      this.currentlyPlayingId.set(null);
      speechSynthesis.cancel();
    }
  }

  speak(id: string, text: string, voice: SpeechSynthesisVoice | null): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!('speechSynthesis' in window)) {
            console.error('Speech Synthesis not supported in this browser.');
            return reject('Speech Synthesis not supported');
        }

        // We don't call stop() here because it would reset currentlyPlayingId, which the loop controller needs.
        // The controller ensures only one thing is spoken at a time.
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }

        this.utterance = new SpeechSynthesisUtterance(text);
        if (voice) {
            this.utterance.voice = voice;
        }
        this.utterance.lang = 'de-DE';
        this.utterance.rate = 0.95;
        this.utterance.pitch = 1.0;

        this.utterance.onstart = () => {
            this.currentlyPlayingId.set(id);
        };

        this.utterance.onend = () => {
            // Only clear if it was this utterance. Avoids race conditions.
            if (this.currentlyPlayingId() === id) {
                 this.currentlyPlayingId.set(null);
            }
            resolve();
        };
        
        this.utterance.onerror = (event) => {
            console.error('SpeechSynthesisUtterance.onerror', event);
             if (this.currentlyPlayingId() === id) {
                this.currentlyPlayingId.set(null);
            }
            reject(event);
        }

        speechSynthesis.speak(this.utterance);
    });
  }
}