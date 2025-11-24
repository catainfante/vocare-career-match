"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "2mb" })); // permite CV largos
// ─────────────────────────────────────────────
// CARGAR CSV CON OFERTAS
// ─────────────────────────────────────────────
const ofertasPath = path_1.default.join(process.cwd(), "data", "ofertas.csv");
let ofertasTexto = "";
try {
    ofertasTexto = fs_1.default.readFileSync(ofertasPath, "utf8");
    console.log("CSV de ofertas cargado correctamente.");
}
catch (error) {
    console.warn("⚠️ No se encontró el archivo data/ofertas.csv.");
}
// Guardaremos el CV enviado por el usuario
let cvGuardado = null;
// ─────────────────────────────────────────────
// ENDPOINT PARA SUBIR CV
// ─────────────────────────────────────────────
app.post("/api/cv", (req, res) => {
    const { cv } = req.body;
    if (!cv || cv.length < 20) {
        return res.status(400).json({ error: "CV inválido o muy corto" });
    }
    cvGuardado = cv;
    return res.json({ message: "CV recibido correctamente" });
});
// ─────────────────────────────────────────────
// ENDPOINT PARA EL CHAT
// ─────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
    const { message } = req.body;
    // ¿Están preguntando por trabajo?
    const hablaTrabajo = /trabajo|empleo|oferta|recomienda|carrera|vocación|profesión/i.test(message);
    // ¿El usuario subió un CV?
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
        const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
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
        });
        if (!response.ok) {
            const text = await response.text();
            return res.status(500).json({ error: text });
        }
        const json = await response.json();
        const reply = json?.choices?.[0]?.message?.content ?? "(sin respuesta)";
        res.json({ reply });
    }
    catch (err) {
        res.status(500).json({ error: "Error interno en el servidor" });
    }
});
app.listen(3001, () => {
    console.log("Servidor IA corriendo en http://localhost:3001");
});
