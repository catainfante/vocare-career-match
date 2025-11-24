import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Permite CV más grandes

// ─────────────────────────────────────────────
// CARGAR CSV CON OFERTAS
// ─────────────────────────────────────────────
const ofertasPath = path.join(process.cwd(), "data", "ofertas.csv");
let ofertasTexto = "";

try {
  ofertasTexto = fs.readFileSync(ofertasPath, "utf8");
  console.log("CSV de ofertas cargado correctamente.");
} catch (error) {
  console.warn("⚠️ No se encontró el archivo data/ofertas.csv.");
}

// Guardaremos el CV enviado por el usuario
let cvGuardado: string | null = null;

// ─────────────────────────────────────────────
// ENDPOINT PARA SUBIR CV
// ─────────────────────────────────────────────
app.post("/api/cv", (req, res) => {
  const cv = req.body.cv as string | undefined;

  if (!cv || cv.length < 20) {
    return res.status(400).json({ error: "CV inválido o muy corto" });
  }

  cvGuardado = cv;

  // Log seguro
  console.log(
    "CV recibido (primeros 50 caracteres):",
    cvGuardado.slice(0, 50)
  );

  return res.json({ message: "CV recibido correctamente" });
});

// ─────────────────────────────────────────────
// ENDPOINT PARA EL CHAT
// ─────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  const hablaTrabajo =
    /trabajo|empleo|oferta|recomienda|carrera|vocación|profesión/i.test(
      message
    );

  const tieneCV = Boolean(cvGuardado);

  const systemPrompt = `
Eres un orientador laboral experto. Tu misión:

1) **Leer el CV del usuario (si existe)** y demostrar que lo entendiste comentando:
   - Experiencia principal
   - Fortalezas detectadas
   - Áreas mejorables
   - Nivel técnico aproximado
   - Un pequeño resumen de quién es el candidato

   IMPORTANTE: SIEMPRE comenta el CV cuando el usuario hable de él o cuando pregunte por recomendaciones laborales.

2) **Recomendar empleos** usando el siguiente CSV:
${hablaTrabajo ? ofertasTexto : "(el usuario no pidió trabajo, no uses el CSV)"}

3) Mantener el estilo:
   - Respuestas claras y naturales
   - Cero repetición
   - Flexibilidad total
   - Lenguaje amigable

4) Si el usuario no ha subido un CV y pide recomendaciones,
   sugiérele que suba su CV primero para mejorar la recomendación.

──────────────────────────
CV DEL USUARIO:
${tieneCV ? cvGuardado : "(no hay CV cargado todavía)"}
──────────────────────────
`;

  try {
    const response = await fetch(
      "https://api.deepseek.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          temperature: 0.9,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: text });
    }

    const json = await response.json();
    const reply = json?.choices?.[0]?.message?.content ?? "(sin respuesta)";
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: "Error interno en el servidor" });
  }
});

app.listen(3001, () => {
  console.log("Servidor IA corriendo en http://localhost:3001");
});
