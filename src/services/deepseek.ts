// src/services/deepseek.ts

// Asegúrate de tener dotenv configurado en tu archivo principal:
// import dotenv from "dotenv";
// dotenv.config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

export async function askDeepSeek(message: string): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error(
      "Falta la variable DEEPSEEK_API_KEY en .env. " +
      "Crea un archivo .env en la raíz y agrega: DEEPSEEK_API_KEY=TU_KEY"
    );
  }

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "user", content: message }
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Error en API DeepSeek: ${response.status} ${text}`);
    }

    const data = await response.json();

    return data?.choices?.[0]?.message?.content ?? "(sin respuesta)";

  } catch (error: any) {
    console.error("Error llamando a DeepSeek:", error);
    return "Ocurrió un error conectándome a la IA.";
  }
}
