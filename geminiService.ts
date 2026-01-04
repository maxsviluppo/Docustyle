
import { GoogleGenAI } from "@google/genai";

// Use the API key directly from process.env as per GenAI SDK guidelines
function getAI() {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

export async function refineDocumentContent(content: string, instruction: string): Promise<string> {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Refine the following document content based on this instruction: "${instruction}". 
      Maintain the HTML structure as much as possible but improve the professional tone and flow.
      
      CONTENT:
      ${content}`,
    });
    // Use .text property as a getter, not a method
    return response.text || content;
  } catch (error: any) {
    console.error("Error refining document:", error);
    if (error.message?.includes("Requested entity was not found")) {
        throw new Error("API_KEY_RESET");
    }
    return content;
  }
}

export async function formatDocumentStructure(content: string): Promise<string> {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following raw text and transform it into a perfectly structured professional document using HTML tags.
      Rules:
      1. Use <h1> for the main title.
      2. Use <h2> for section headers.
      3. Use <p> for standard paragraphs.
      4. Use <ul> or <ol> for lists if appropriate.
      5. Do not include <html> or <body> tags, just the inner content.
      6. Fix common OCR or typing errors.
      7. Apply professional typesetting logic.

      RAW TEXT:
      ${content}`,
    });
    // Use .text property as a getter, not a method
    return response.text || content;
  } catch (error: any) {
    console.error("Error formatting structure:", error);
    if (error.message?.includes("Requested entity was not found")) {
        throw new Error("API_KEY_RESET");
    }
    return content;
  }
}

export async function generateFootnotes(content: string): Promise<string> {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Read the following document text and suggest 3 professional footnotes or references that would make this document more authoritative. 
      Return only the text for the footnotes, separated by new lines.
      
      TEXT:
      ${content.replace(/<[^>]*>?/gm, '')}`,
    });
    // Use .text property as a getter, not a method
    return response.text || '';
  } catch (error: any) {
    console.error("Error generating footnotes:", error);
    if (error.message?.includes("Requested entity was not found")) {
        throw new Error("API_KEY_RESET");
    }
    return '';
  }
}

export async function extractTextFromImage(base64Data: string, mimeType: string): Promise<string> {
  const ai = getAI();
  try {
    // Update contents structure for multimodal input as per SDK guidelines
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: "Extract the text from this image and format it into professional HTML paragraphs. Only return the HTML content, no explanations." },
          { inlineData: { data: base64Data, mimeType } }
        ]
      }
    });
    // Use .text property as a getter, not a method
    return response.text || '';
  } catch (error: any) {
    console.error("Error extracting text from image:", error);
    if (error.message?.includes("Requested entity was not found")) {
        throw new Error("API_KEY_RESET");
    }
    return "Errore durante l'acquisizione del testo.";
  }
}
