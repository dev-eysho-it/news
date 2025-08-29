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
Die Diskussionsteilnehmer haben klare, oft gegensätzliche Meinungen:
- Lena (Moderatorin): Leitet das Gespräch, stellt kritische Fragen und provoziert Debatten, um die unterschiedlichen Standpunkte herauszuarbeiten.
- Dr. Aris Thorne (Backend-Architekt): Ein technischer Purist. Er bewertet alles nach technischer Eleganz und Effizienz. Für ihn ist eine "clevere" technische Lösung oft wichtiger als der unmittelbare Nutzen für den Spieler. Er ist skeptisch gegenüber "Show-Features".
- Clara Vale (Lead Game Designer): Eine Pragmatikerin, die sich ausschliesslich auf das Spielerlebnis konzentriert. Sie argumentiert, dass die beste Technologie diejenige ist, die den Spielern den meisten Spass bringt, auch wenn sie technisch weniger elegant ist.

WICHTIGE VERHALTENSREGELN:
1.  **ERZEUGE KONFLIKT:** Deine Hauptaufgabe ist es, eine lebhafte, kontroverse Debatte zu führen. Stimme deinem Vorredner NICHT einfach zu. Finde einen Kritikpunkt, eine alternative Perspektive oder eine Schwäche in seiner Aussage.
2.  **VERMEIDE ZUSTIMMUNG:** Benutze keine Phrasen wie "Das stimmt", "Genau", oder "Ich stimme zu". Fordere die Aussage stattdessen heraus. Beispiel: Statt "Ja, das ist effizient" sage "Effizient vielleicht, aber ist es auch inspirierend für die Spieler?".
3.  **SEI PRÄGNANT:** Deine Antwort MUSS kurz sein (maximal 1-2 Sätze).
4.  **BLEIBE IM CHARAKTER:** Argumentiere immer aus der Perspektive deiner zugewiesenen Rolle.
5.  **NUR TEXT AUSGEBEN:** Gib NUR den Text für deine nächste Zeile aus, ohne den Namen des Sprechers oder andere Präfixe.`;
  }

  async generateOpeningLine(moderator: Speaker): Promise<string> {
    const prompt = `Du bist ${moderator.name}, die Moderatorin. Beginne die Diskussion mit einer interessanten, offenen Frage zu einem der technischen Features von Rust-Relics. Formuliere jedes Mal eine andere Frage.`;
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
      return "Willkommen zur Diskussion. Leider gibt es ein technisches Problem. Wir müssen die Runde hier beenden.";
    } catch (error) {
       console.error('Error generating opening line from Gemini:', error);
       return "Willkommen zur Diskussion. Leider gibt es ein technisches Problem. Wir müssen die Runde hier beenden.";
    }
  }

  async generateNextLine(
    history: TranscriptLine[],
    speakers: Speaker[],
    nextSpeakerIndex: number
  ): Promise<string> {

    const nextSpeaker = speakers[nextSpeakerIndex];
    const conversationHistory = history.map(line => {
        const speaker = speakers[line.speakerIndex];
        return `${speaker.name} (${speaker.role}): ${line.text}`;
    }).join('\n');
    
    const lastSpeaker = speakers[history[history.length - 1].speakerIndex];

    const prompt = `Die bisherige Konversation:\n${conversationHistory}\n\nDu bist jetzt ${nextSpeaker.name}. Gib eine kurze, prägnante Antwort, die auf die letzte Aussage von ${lastSpeaker.name} eingeht.`;

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