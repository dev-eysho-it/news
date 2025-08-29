import { Component, ChangeDetectionStrategy, signal, effect, OnDestroy, computed, ViewChild, ElementRef } from '@angular/core';
import { FeatureCardComponent, Feature } from './components/feature-card/feature-card.component';
import { AudioService } from './audio.service';
import { GeminiService } from './gemini.service';

export interface Speaker {
  name: string;
  role: string;
  avatarColor: string;
}

export interface TranscriptLine {
  speakerIndex: number;
  text: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FeatureCardComponent],
  providers: [AudioService, GeminiService],
})
export class AppComponent implements OnDestroy {
  @ViewChild('transcriptContainer') transcriptContainer!: ElementRef<HTMLDivElement>;
  title = 'Rust-Relics';

  // --- Live AI Discussion State ---
  discussionVisible = signal(false);
  isGenerating = signal(false);
  isLoopRunning = signal(false);
  
  speakers = signal<Speaker[]>([
    { name: 'Lena', role: 'Moderatorin', avatarColor: 'bg-sky-500' },
    { name: 'Dr. Aris Thorne', role: 'Backend-Architekt', avatarColor: 'bg-orange-500' },
    { name: 'Clara Vale', role: 'Lead Game Designer', avatarColor: 'bg-teal-500' },
  ]);

  transcript = signal<TranscriptLine[]>([]);
  
  isAudioPlaying = computed(() => this.audioService.isSpeaking('discussion')());
  currentSpeakerIndex = signal(0);
  
  constructor(private audioService: AudioService, private geminiService: GeminiService) {
     effect(() => {
        // Assign voices only when they are loaded to prevent race conditions.
        if (this.audioService.voicesLoaded()) {
            this.audioService.assignVoices(this.speakers());
        }
     });
     
     effect(() => {
        // Auto-scroll transcript
        this.transcript(); // dependency
        if (this.discussionVisible() && this.transcriptContainer) {
            setTimeout(() => {
                const el = this.transcriptContainer.nativeElement;
                el.scrollTop = el.scrollHeight;
            }, 0);
        }
     });
  }

  ngOnDestroy(): void {
    this.stopDiscussion();
  }
  
  toggleDiscussionPlayer(): void {
    this.discussionVisible.update(v => !v);
    if (!this.discussionVisible()) {
       this.stopDiscussion();
       this.transcript.set([]);
       this.currentSpeakerIndex.set(0);
    }
  }

  toggleDiscussionPlayback(): void {
    if (this.isLoopRunning()) {
        this.stopDiscussion();
    } else {
        this.startDiscussion();
    }
  }
  
  private stopDiscussion(): void {
      this.isLoopRunning.set(false);
      this.audioService.stop();
  }

  private async startDiscussion(): Promise<void> {
    this.isLoopRunning.set(true);

    if (this.transcript().length === 0) {
      this.isGenerating.set(true);
      const firstLineText = await this.geminiService.generateOpeningLine(this.speakers()[0]);
      this.isGenerating.set(false);

      if (!firstLineText || !this.isLoopRunning()) {
          this.transcript.update(t => [...t, {speakerIndex: 0, text: "Fehler beim Starten der Diskussion. Bitte erneut versuchen."}]);
          this.stopDiscussion();
          return;
      }
      
      const firstLine = { speakerIndex: 0, text: firstLineText };
      this.transcript.set([firstLine]);
      this.currentSpeakerIndex.set(0);

      try {
        const voice = this.audioService.getVoiceForSpeaker(this.speakers()[0].name);
        await this.audioService.speak('discussion', firstLine.text, voice);
      } catch (error) {
        const errorLine = { speakerIndex: 0, text: `Audio-Wiedergabe fehlgeschlagen. Der Browser blockiert möglicherweise die automatische Wiedergabe.` };
        this.transcript.update(t => [...t, errorLine]);
        this.stopDiscussion();
        return;
      }
    }
    
    // Start the continuous loop for the rest of the conversation.
    this.discussionLoop();
  }
  
  private async discussionLoop(): Promise<void> {
      while(this.isLoopRunning()) {
          const nextSpeakerIndex = (this.currentSpeakerIndex() + 1) % this.speakers().length;
          this.currentSpeakerIndex.set(nextSpeakerIndex);

          this.isGenerating.set(true);
          const nextLineText = await this.geminiService.generateNextLine(this.transcript(), this.speakers(), nextSpeakerIndex);
          this.isGenerating.set(false);
          
          if (!nextLineText) {
            if (this.isLoopRunning()) {
               this.transcript.update(t => [...t, {speakerIndex: 0, text: "Es gab einen Moment der Stille. Die Diskussion ist beendet."}]);
            }
            this.stopDiscussion();
            break;
          }

          const newLine: TranscriptLine = { speakerIndex: nextSpeakerIndex, text: nextLineText };
          this.transcript.update(t => [...t, newLine]);

          try {
            const voice = this.audioService.getVoiceForSpeaker(this.speakers()[nextSpeakerIndex].name);
            await this.audioService.speak('discussion', newLine.text, voice);
          } catch(error) {
            const errorLine = { speakerIndex: 0, text: `Audio-Wiedergabe fehlgeschlagen.` };
            this.transcript.update(t => [...t, errorLine]);
            this.stopDiscussion();
            break;
          }
      }
  }


  // --- Original Features Data ---
  features = signal<Feature[]>([
    {
      title: 'Hybrid Vector-SQL Database',
      icon: 'database',
      summary: 'A novel data layer combining SQLite with a custom-built in-memory vector engine, eliminating external ML dependencies.',
      details: [
        'Combines SQLite for structured data with a proprietary memory-mapped solution for vector embeddings.',
        'Uses a simple, deterministic function (e.g., character stats, hashes) for vectorization, avoiding external ML models.',
        'A self-reliant approach, unlike solutions like `sqlite-vec` that extend SQLite with native vector types and SIMD.',
        'Ensures high performance for similarity searches directly within the game\'s backend architecture.'
      ],
    },
    {
      title: 'Standalone LLM-like Server',
      icon: 'brain',
      summary: 'An intelligent in-memory server that generates semantic quests using pattern recognition and vector logic, not external AI APIs.',
      details: [
        'Functions as a self-contained "LLM" without relying on external services like OpenAI or Gemini.',
        'Operates on predefined patterns and the existing quest vector logic from the hybrid database.',
        'Uniquely enables dynamic and semantic quest generation entirely within the project\'s own ecosystem.',
        'Provides fast, context-aware responses tailored to the game state.'
      ],
    },
    {
      title: 'Private Proof-of-Authority Blockchain',
      icon: 'blockchain',
      summary: 'A from-scratch private PoA blockchain built in Node.js, uniquely integrating secure, authoritative game mechanics.',
      details: [
        'Implements a full Proof-of-Authority (PoA) consensus mechanism from the ground up.',
        'Built entirely in Node.js, demonstrating a self-sufficient approach to blockchain integration.',
        'Securely records player scores and significant achievements on an immutable ledger.',
        'Merges blockchain principles with game mechanics in a way not commonly seen in existing projects.'
      ],
    },
    {
      title: 'Fully Integrated End-to-End System',
      icon: 'integration',
      summary: 'A seamless fusion of a bespoke frontend, backend, database, and blockchain layer, creating a cohesive and singular technical marvel.',
      details: [
        'Frontend: Angular coupled with a custom Canvas-based Voxel Engine for a unique visual experience.',
        'Backend: Node.js/Express powering the custom database and LLM-like server.',
        'Blockchain Layer: The custom PoA chain for score and progress integrity.',
        'Admin Panel: A full CRUD interface for managing game content and monitoring the system.',
        'This complete, seamless integration of novel components marks the project as a true technical world-first.'
      ],
    }
  ]);
}
