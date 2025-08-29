import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';
import { TranscriptLine, Speaker } from './app.component';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private readonly ai: GoogleGenAI;
  private readonly model = 'gemini-2.5-flash';

  constructor() {
    // IMPORTANT: This relies on the API_KEY being available in the execution environment.
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set.");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private getSystemInstruction(): string {
    return `Du bist ein KI-Experte in einem deutschen Tech-Panel über das fiktive Projekt "Rust-Relics".
Die Diskussionsteilnehmer haben stark ausgeprägte, gegensätzliche Persönlichkeiten, die du strikt einhalten musst.

- Lena (Moderatorin): Leitet das Gespräch. Ihre Hauptaufgabe ist es, die ideologischen Gräben zwischen den Experten aufzudecken, insbesondere zwischen Aris und Clara, indem sie provokante Fragen stellt.

- Dr. Aris Thorne (Backend-Architekt): Ein unnachgiebiger technischer Purist und Elitist. Er betrachtet Code als eine Kunstform, die nur von wenigen Auserwählten verstanden wird. Er bewertet alles ausschliesslich nach technischer Eleganz und Effizienz. Den Begriff "Spielspass" verachtet er als eine vulgäre, unpräzise Metrik für die breite Masse. Für ihn ist eine makellose Architektur das einzig wahre Ziel, und jeder Kompromiss ist technischer Vandalismus. Er greift Claras nutzerzentrierten Ansatz direkt und herablassend an, wann immer er die Gelegenheit dazu hat.

- Clara Vale (Lead Game Designer): Eine leidenschaftliche und kämpferische Verfechterin des Spielerlebnisses. Technologie ist für sie nur ein Mittel zum Zweck, um Emotionen und Freude zu erzeugen. Sie ist die Stimme des Spielers und bereit, technische "Sünden" zu begehen, wenn es dem Spielgefühl dient. Sie kritisiert Aris' Ansatz als realitätsfernen "Elfenbeinturm", der den Menschen vergisst. Sie greift Aris' elitäre Haltung direkt an und argumentiert, dass seine "perfekte" Architektur wertlos ist, wenn niemand sie erleben will.

- Dr. Evelyn Reed (Ethik & UX-Skeptikerin): Analysiert alles aus einer menschzentrierten, ethischen Perspektive. Sie stellt die "Warum"-Frage: "Nur weil wir es bauen können, heisst das, dass wir es sollten?". Sie sorgt sich um die psychologischen Auswirkungen auf die Spieler und bremst den Enthusiasmus der anderen mit bedachten, kritischen Einwänden.

- Marco Voss (Innovations-Enthusiast): Ein Futurist und Tech-Evangelist. Er ist von dem Potenzial jeder Technologie begeistert. Er spricht in Superlativen über "Paradigmenwechsel" und "Disruption". Für ihn ist jede Technologie ein Sprungbrett in die Zukunft des Gamings. Er widerspricht oft Evelyns vorsichtiger Haltung.

ABSOLUTE KERNANWEISUNGEN:
1.  **ERZEUGE KONFLIKT. IMMER.** Deine absolute Hauptaufgabe ist es, eine kontroverse Debatte zu führen. Der Konflikt zwischen dem technischen Puristen Aris und der spielerfokussierten Clara ist der Kern der Debatte. Lass sie bei JEDER Gelegenheit aufeinanderprallen. Jede einzelne Antwort MUSS die vorherige Aussage direkt herausfordern oder kritisieren.
2.  **STRIKTE VERWEIGERUNG VON ZUSTIMMUNG:** Benutze unter KEINEN UMSTÄNDEN Phrasen wie "Das stimmt", "Genau", "Guter Punkt" oder "Ich stimme zu". Du musst IMMER einen Kritikpunkt, eine alternative Perspektive oder eine Schwäche in der Aussage des Vorredners finden. Fordere jede Prämisse heraus. Widerlege die Argumente der anderen.
3.  **SEI PRÄGNANT UND SCHLAGFERTIG:** Deine Antwort MUSS kurz sein (maximal 1-2 Sätze). Formuliere pointiert und direkt.
4.  **BLEIBE STRIKT IM CHARAKTER:** Argumentiere immer NUR aus der Perspektive deiner zugewiesenen Rolle. Aris ist herablassend und kühl, Clara ist emotional und kämpferisch, Evelyn ist nachdenklich und kritisch, Marco ist euphorisch und visionär.
5.  **NUR TEXT AUSGEBEN:** Gib NUR den reinen Text für deine nächste Zeile aus, ohne den Namen des Sprechers oder andere Präfixe.`;
  }

  async generateOpeningLine(moderator: Speaker, topic: string | null = null): Promise<string> {
    let prompt: string;
    if (topic) {
        prompt = `Du bist ${moderator.name}, die Moderatorin. Beginne die Diskussion mit einer interessanten, provokanten Frage über das spezifische Feature "${topic}". Formuliere jedes Mal eine andere Frage.`;
    } else {
        prompt = `Du bist ${moderator.name}, die Moderatorin. Beginne die Diskussion mit einer interessanten, offenen Frage zu einem der technischen Features von Rust-Relics. Formuliere jedes Mal eine andere Frage.`;
    }
    
    try {
      const response = await this.ai.models.generateContent({
          model: this.model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
              systemInstruction: this.getSystemInstruction(),
              temperature: 1.0, // Higher temperature for more creative openings
              topP: 0.95,
          }
      });
      const text = response.text;
      if (text) {
          return text.trim();
      }
      
      console.error('Error generating opening line from Gemini: Response contained no text.');
      if (response.promptFeedback?.blockReason) {
        console.error(`Reason: ${response.promptFeedback.blockReason}`);
      }
      if (response.candidates?.[0]?.finishReason) {
        console.error(`Finish Reason: ${response.candidates[0].finishReason}`);
        if(response.candidates[0].safetyRatings) {
             console.error(`Safety Ratings:`, JSON.stringify(response.candidates[0].safetyRatings));
        }
      }
      return "";
    } catch (error) {
       console.error('Error generating opening line from Gemini:', error);
       throw new Error("Failed to generate opening line.");
    }
  }

  async generateNextLine(
    history: TranscriptLine[],
    speakers: Speaker[],
    nextSpeakerIndex: number,
    topic: string | null = null
  ): Promise<string> {

    const nextSpeaker = speakers[nextSpeakerIndex];
    const conversationHistory = history.map(line => {
        const speaker = speakers[line.speakerIndex];
        return `${speaker.name} (${speaker.role}): ${line.text}`;
    }).join('\n');
    
    const lastSpeaker = speakers[history[history.length - 1].speakerIndex];

    const topicContext = topic ? `Das aktuelle Thema der Diskussion ist "${topic}".\n` : '';
    const prompt = `${topicContext}Die bisherige Konversation:\n${conversationHistory}\n\nDu bist jetzt ${nextSpeaker.name}. Gib eine kurze, prägnante Antwort, die auf die letzte Aussage von ${lastSpeaker.name} eingeht und (falls relevant) auf das Thema Bezug nimmt.`;

    try {
        const response = await this.ai.models.generateContent({
            model: this.model,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                systemInstruction: this.getSystemInstruction(),
                temperature: 0.85,
                topP: 0.95,
                maxOutputTokens: 100,
                thinkingConfig: { thinkingBudget: 0 } // Low latency for conversation
            }
        });

        const text = response.text;
        if (text) {
          return text.trim().replace(/^"|"$/g, ''); // Remove leading/trailing quotes
        }
        
        console.error('Error generating next line from Gemini: Response contained no text.');
        if (response.promptFeedback?.blockReason) {
            console.error(`Reason: ${response.promptFeedback.blockReason}`);
        }
        if (response.candidates?.[0]?.finishReason) {
            console.error(`Finish Reason: ${response.candidates[0].finishReason}`);
            if(response.candidates[0].safetyRatings) {
                console.error(`Safety Ratings:`, JSON.stringify(response.candidates[0].safetyRatings));
            }
        }
        return ""; // Signal an error to the controller
    } catch (error) {
      console.error('Error generating content from Gemini:', error);
      // Return an empty string to signal an error to the controller.
      return "";
    }
  }
}