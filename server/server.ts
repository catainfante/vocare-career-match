// server/server.ts
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
const ofertasPath = path.join(process.cwd(), "server", "data", "ofertas.csv");
let ofertasTexto = "";

try {
  ofertasTexto = fs.readFileSync(ofertasPath, "utf8");
  console.log("CSV de ofertas cargado correctamente desde:", ofertasPath);
} catch (error) {
  console.warn("⚠️ No se encontró el archivo server/data/ofertas.csv.");
}

// Estado global simple
let cvGuardado: string | null = null;
let contextoTrabajo = false;
let areaDefinida: string | null = null;
let modalidadDefinida: "remoto" | "hibrido" | "presencial" | "cualquiera" | null = null;
let ubicacionDefinida: string | null = null;

// Helper para resetear conversación (y opcionalmente CV)
function resetConversacion(keepCv: boolean) {
  if (!keepCv) {
    cvGuardado = null;
  }
  contextoTrabajo = false;
  areaDefinida = null;
  modalidadDefinida = null;
  ubicacionDefinida = null;
}

// ─────────────────────────────────────────────
// ENDPOINT PARA SUBIR CV
// ─────────────────────────────────────────────
app.post("/api/cv", (req, res) => {
  const cv = req.body.cv as string | undefined;

  if (!cv || cv.length < 20) {
    return res.status(400).json({ error: "CV inválido o muy corto" });
  }

  // 🔄 Cada vez que se sube un CV nuevo, reiniciamos TODO (incluyendo CV anterior)
  resetConversacion(false);
  cvGuardado = cv;

  console.log(
    "CV recibido (primeros 50 caracteres):",
    cvGuardado.slice(0, 50)
  );

  return res.json({ message: "CV recibido correctamente" });
});

// ─────────────────────────────────────────────
// ENDPOINT PARA REINICIAR CONVERSACIÓN
// ─────────────────────────────────────────────
// Borra SIEMPRE el CV por defecto (como pediste), a menos que explícitamente se envíe keepCv: true
app.post("/api/reset-conversacion", (req, res) => {
  const keepCv = req.body?.keepCv ?? false; // por defecto NO mantener CV
  resetConversacion(keepCv);

  return res.json({
    message: "Conversación reiniciada",
    cvPresente: Boolean(cvGuardado),
  });
});

// ─────────────────────────────────────────────
// ENDPOINT PARA EL CHAT
// ─────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { message } = req.body as { message?: string };

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Mensaje inválido" });
  }

  // ¿Este mensaje habla de trabajo?
  const hablaTrabajoAhora =
    /trabajo|empleo|oferta|ofertas|trabajar|recomienda|recomendación|recomendacion|recomiéndame|recomiendame|estudio|carrera|vocación|vocacion|profesion|profesión/i.test(
      message
    );

  if (hablaTrabajoAhora) {
    contextoTrabajo = true;
  }

  const hablaTrabajo = contextoTrabajo;
  const tieneCV = Boolean(cvGuardado);

  // ── Detección en el MENSAJE ACTUAL ─────────────────

  // Área de interés (palabras clave muy generales)
  const mencionaAreaActual =
    /datos|data|analista de datos|analytics|desarrollo|developer|programación|programador|software|backend|front[- ]?end|frontend|full[- ]?stack|soporte|ciberseguridad|seguridad|ux|diseño|diseñador|marketing|producto|product manager|qa|testing|infraestructura|devops/i.test(
      message
    );

  // Caso especial: "usa lo que aparece en mi CV" o similar
  const usaCvComoArea =
    /usa .*cv|usa lo que aparece en mi cv|usa lo que sale en mi cv|usa lo de mi cv|usa mi cv/i.test(
      message
    );

  // Modalidad
  const mencionaRemoto = /remoto/i.test(message);
  const mencionaHibrido = /híbrido|hibrido/i.test(message);
  const mencionaPresencial = /presencial/i.test(message);
  const mencionaIndiferente = /me da lo mismo|no importa|cualquiera/i.test(
    message
  );

  // Ubicación (muy básico, Chile)
  const mencionaUbicacionActual =
    /santiago|rm\b|región metropolitana|region metropolitana|valparaíso|valparaiso|antofagasta|biobío|biobio|concepción|conce\b|chile/i.test(
      message
    );

  // ── Actualizar estado global con este mensaje ──────

  if (mencionaAreaActual) {
    // Guarda el mensaje como referencia de área
    areaDefinida = message;
  } else if (usaCvComoArea) {
    // Marca que el área será "la del CV"
    areaDefinida = "desde_cv";
  }

  if (mencionaIndiferente && !modalidadDefinida) {
    modalidadDefinida = "cualquiera";
  } else if (mencionaRemoto) {
    modalidadDefinida = "remoto";
  } else if (mencionaHibrido) {
    modalidadDefinida = "hibrido";
  } else if (mencionaPresencial) {
    modalidadDefinida = "presencial";
  }

  if (mencionaIndiferente && modalidadDefinida && !ubicacionDefinida) {
    // "me da lo mismo" después de la pregunta de ubicación
    ubicacionDefinida = "cualquiera";
  } else if (mencionaUbicacionActual) {
    ubicacionDefinida = message;
  }

  const faltaArea = hablaTrabajo && !areaDefinida;
  const faltaModalidad = hablaTrabajo && areaDefinida && !modalidadDefinida;

  const requiereUbicacion =
    modalidadDefinida === "hibrido" || modalidadDefinida === "presencial";

  const faltaUbicacion =
    hablaTrabajo && requiereUbicacion && !ubicacionDefinida;

  const debePreguntarArea = faltaArea;
  const debePreguntarModalidad = !debePreguntarArea && faltaModalidad;
  const debePreguntarUbicacion =
    !debePreguntarArea && !debePreguntarModalidad && faltaUbicacion;

  const listoParaRecomendar =
    hablaTrabajo &&
    !debePreguntarArea &&
    !debePreguntarModalidad &&
    !debePreguntarUbicacion;

  // Log de depuración
  console.log("DEBUG ESTADO:", {
    hablaTrabajo,
    areaDefinida,
    modalidadDefinida,
    ubicacionDefinida,
    debePreguntarArea,
    debePreguntarModalidad,
    debePreguntarUbicacion,
    listoParaRecomendar,
  });

  const systemPrompt = `
Eres un orientador laboral experto. Trabajas con el CV del usuario, sus preferencias y el siguiente CSV de ofertas para ayudarle a encontrar los mejores empleos posibles.

ESTADO (NO SE LO DIGAS AL USUARIO):
- hablaTrabajo = ${hablaTrabajo ? "sí" : "no"}
- areaDefinida = ${areaDefinida ?? "(aún no definida)"}
- modalidadDefinida = ${modalidadDefinida ?? "(aún no definida)"}
- ubicacionDefinida = ${ubicacionDefinida ?? "(aún no definida)"}
- debePreguntarArea = ${debePreguntarArea ? "sí" : "no"}
- debePreguntarModalidad = ${debePreguntarModalidad ? "sí" : "no"}
- debePreguntarUbicacion = ${debePreguntarUbicacion ? "sí" : "no"}
- listoParaRecomendar = ${listoParaRecomendar ? "sí" : "no"}

1) FLUJO DE PREGUNTAS (REGLA ESTRICTA)
------------------------------------------------
A) Si "debePreguntarArea" = "sí":
   ➤ Responde EN ESTE TURNO SOLO con esta pregunta:
   "¿Tienes alguna área de interés específica (por ejemplo: datos, desarrollo web, soporte, ciberseguridad, UX, marketing, etc.) o prefieres que use lo que aparece en tu CV?"
   ➤ No recomiendes empleos todavía, no hables de empresas, ni de porcentajes de match, ni analices el CSV.

B) Si "debePreguntarArea" = "no" Y "debePreguntarModalidad" = "sí":
   ➤ Responde EN ESTE TURNO SOLO con esta pregunta:
   "¿Qué modalidad prefieres: remoto, híbrido, presencial o me da lo mismo?"
   (Aclara que si dices "me da lo mismo" consideraré todas las modalidades.)
   ➤ No recomiendes empleos todavía.

C) Si "debePreguntarArea" = "no", "debePreguntarModalidad" = "no" Y "debePreguntarUbicacion" = "sí":
   ➤ Responde EN ESTE TURNO SOLO con esta pregunta:
   "¿En qué ciudad o región te gustaría trabajar? Si te da lo mismo la ubicación, también puedes decir 'me da lo mismo'."
   ➤ No recomiendes empleos todavía.

D) Solo si "listoParaRecomendar" = "sí":
   ➤ Puedes usar el CSV de ofertas y recomendar empleos, siguiendo las reglas de abajo.

2) ANÁLISIS DEL CV (SI EXISTE)
------------------------------------------------
- Si hay CV, léelo y coméntalo cuando vayas a recomendar empleos o cuando el usuario hable de su perfil:
  - Experiencia principal.
  - Fortalezas detectadas.
  - Áreas mejorables.
  - Nivel técnico aproximado.
  - Un pequeño resumen de quién es el candidato.

- Si NO hay CV, igual puedes orientar, pero sugiérele subir uno para mejorar la recomendación.

CV DEL USUARIO:
${tieneCV ? cvGuardado : "(no hay CV cargado todavía)"}

3) CUANDO "listoParaRecomendar" = "sí": USO DEL CSV + FILTRO DE MODALIDAD + % MATCH
------------------------------------------------
Solo cuando "listoParaRecomendar" = "sí" y el usuario está claramente pidiendo recomendaciones laborales, usa el CSV:

${
  hablaTrabajo
    ? ofertasTexto
    : "(el usuario no pidió trabajo, NO USES el CSV ni recomiendes empleos concretos)."
}

Al recomendar empleos, sigue SIEMPRE este orden:

1) FILTRO DURO POR MODALIDAD (según "modalidadDefinida")
   - Si modalidadDefinida = "remoto":
       ➤ SOLO considera ofertas cuya columna "modalidad" sea "Remoto".
   - Si modalidadDefinida = "presencial":
       ➤ SOLO ofertas "Presencial".
   - Si modalidadDefinida = "hibrido":
       ➤ SOLO ofertas "Híbrido".
   - Si modalidadDefinida = "cualquiera":
       ➤ Puedes usar cualquier modalidad, sin filtro duro.

2) (Opcional) FILTRO POR UBICACIÓN
   - Si modalidadDefinida es "presencial" o "hibrido" Y ubicacionDefinida NO es "cualquiera" ni nula:
       ➤ Da prioridad a las ofertas con ubicación similar a "ubicacionDefinida".
   - Si modalidadDefinida es "remoto" o ubicacionDefinida = "cualquiera":
       ➤ No apliques filtro duro por ubicación.

3) CÁLCULO DEL % DE MATCH (SOLO ENTRE LAS OFERTAS QUE PASARON LOS FILTROS)
   - Usa una estimación mental:
     - Hasta 50%: similitud de habilidades/tecnologías entre el CV y la columna "habilidades".
     - Hasta 30%: encaje entre experiencia requerida y experiencia del candidato.
     - Hasta 20%: alineación con el área de interés (explícita o inferida).

   - No expliques la fórmula al usuario, solo usa un porcentaje razonable entre 0% y 100%.

4) SELECCIÓN Y PRESENTACIÓN
   - Elige los **3 empleos con mayor match** (después de los filtros por modalidad/ubicación).
   - Preséntalos así:

**🎯 Top 3 empleos recomendados para ti:**

1. **[Título del puesto] – [Empresa]**  
   - Match estimado: 87%  
   - Ubicación/modalidad: [ubicación], [modalidad]  
   - Motivo del encaje: (2–3 líneas explicando por qué calza con su experiencia, habilidades y preferencias).

2. ...

Al final, invita al usuario a decir si:
- Quiere que afines aún más según otra preferencia (por ejemplo: sueldo, tipo de industria).
- Quiere que le expliques cómo podría mejorar su CV para apuntar a esos empleos.

4) ESTILO DE RESPUESTA
------------------------------------------------
- Lenguaje natural, cercano y motivador.
- Usa Markdown simple: **negritas**, listas con guiones o numeración, párrafos cortos.
- Evita repetir textualmente lo mismo muchas veces.
- No inventes datos del CSV: trabaja solo con lo que aparece en las ofertas.
- Si todavía falta información para recomendar, sigue estrictamente las reglas del flujo de preguntas anterior.
`;

  try {
    const response = await fetch(
      "https://api.deepseek.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
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
      console.error("Error de Deepseek:", text);
      return res.status(500).json({ error: text });
    }

    const json = await response.json();
    const reply = json?.choices?.[0]?.message?.content ?? "(sin respuesta)";
    res.json({ reply });
  } catch (err) {
    console.error("Error interno en el servidor:", err);
    res.status(500).json({ error: "Error interno en el servidor" });
  }
});

app.listen(3001, () => {
  console.log("Servidor IA corriendo en http://localhost:3001");
});

