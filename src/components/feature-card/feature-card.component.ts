import { Component, ChangeDetectionStrategy, input, signal, computed, output } from '@angular/core';
import { AudioService } from '../../audio.service';

export type FeatureIcon = 'database' | 'brain' | 'blockchain' | 'integration';

export interface Feature {
  title: string;
  icon: FeatureIcon;
  summary: string;
  details: string[];
}

@Component({
  selector: 'app-feature-card',
  templateUrl: './feature-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureCardComponent {
  feature = input.required<Feature>();
  isExpanded = signal(false);
  discuss = output<string>();
  
  isSpeaking = computed(() => this.audioService.isSpeaking(this.feature().title)());
  
  featureText = computed(() => {
    const feat = this.feature();
    return `${feat.title}. ${feat.summary}. Details: ${feat.details.join('. ')}`;
  });

  constructor(private audioService: AudioService) {}

  toggleExpand(): void {
    this.isExpanded.update(value => !value);
  }

  toggleReadAloud(): void {
    this.audioService.toggleTTS(this.feature().title, this.featureText());
  }
  
  onDiscussClick(): void {
    this.discuss.emit(this.feature().title);
  }
}