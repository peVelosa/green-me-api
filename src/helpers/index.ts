export function extractJSON(text: string) {
  try {
    // Tenta parsear diretamente
    return JSON.parse(text);
  } catch (e) {
    // Caso haja blocos de código, remove-os
    const jsonString = text.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(jsonString);
    } catch (err) {
      console.error("Erro ao parsear JSON:", err);
      return null;
    }
  }
}
