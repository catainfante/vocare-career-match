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
const ofertasPath = path.join("data", "ofertas.csv");
let ofertasTexto = "";

try {
  ofertasTexto = fs.readFileSync(ofertasPath, "utf8");
  console.log("CSV de ofertas cargado correctamente desde:", ofertasPath);
} catch (error) {
  console.warn("⚠️ No se encontró el archivo", ofertasPath);
}

// Estado global simple (un solo usuario / demo)
let cvGuardado: string | null = null;
let contextoTrabajo = false;
let areaDefinida: string | null = null;
let modalidadDefinida: "remoto" | "hibrido" | "presencial" | "cualquiera" | null = null;
let ubicacionDefinida: string | null = null;

// Flujo de preguntas: área → modalidad → ubicación
let pasoPendiente: "area" | "modalidad" | "ubicacion" | null = null;

// Helper para resetear conversación (y opcionalmente CV)
function resetConversacion(keepCv: boolean) {
  if (!keepCv) {
    cvGuardado = null;
  }
  contextoTrabajo = false;
  areaDefinida = null;
  modalidadDefinida = null;
  ubicacionDefinida = null;
  pasoPendiente = null;
}

// ─────────────────────────────────────────────
// ENDPOINT PARA SUBIR CV
// ─────────────────────────────────────────────
app.post("/api/cv", (req, res) => {
  const cv = req.body.cv as string | undefined;

  if (!cv || cv.length < 20) {
    return res.status(400).json({ error: "CV inválido o muy corto" });
  }

  // Cada vez que se sube un CV nuevo, reiniciamos TODO (incluyendo CV anterior)
  resetConversacion(false);

  // 🔧 Opcional: limitar tamaño del CV para no romper el contexto
  cvGuardado = cv.slice(0, 8000);

  console.log("CV recibido (primeros 50 caracteres):", cvGuardado.slice(0, 50));

  return res.json({ message: "CV recibido correctamente" });
});

// ─────────────────────────────────────────────
// ENDPOINT PARA REINICIAR CONVERSACIÓN
// ─────────────────────────────────────────────
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

  // 🔧 Guardamos el paso con el que ENTRAMOS a esta request
  //    Así nos aseguramos que un mensaje solo avance 1 paso
  const pasoOriginal = pasoPendiente;

  // ¿Este mensaje habla de trabajo?
  const hablaTrabajoAhora =
    /trabajo|empleo|oferta|ofertas|trabajar|recomienda|recomendación|recomendacion|recomiéndame|recomiendame|carrera|vocación|vocacion|profesion|profesión/i.test(
      message
    );

  if (hablaTrabajoAhora) {
    contextoTrabajo = true;
    // 🔧 Si recién entra a tema laboral y aún no hay flujo, marcamos que lo próximo es preguntar ÁREA
    if (!areaDefinida && pasoPendiente === null && pasoOriginal === null) {
      pasoPendiente = "area";
    }
  }

  const hablaTrabajo = contextoTrabajo;
  const tieneCV = Boolean(cvGuardado);

  // ─────────────────────────────────────────────
  // DETECCIÓN BÁSICA EN ESTE MENSAJE
  // ─────────────────────────────────────────────

  const usaCvComoArea =
    /usa .*cv|usa lo que aparece en mi cv|usa lo que sale en mi cv|usa lo de mi cv|usa mi cv/i.test(
      message
    );

  // Modalidad
  const mencionaRemoto = /\bremoto\b|\bRemoto\b/i.test(message);
  const mencionaHibrido = /\bhíbrido\b|\bhibrido\b|\bHíbrido\b|\bHibrido\b/i.test(message);
  const mencionaPresencial = /\bpresencial\b|\bPresencial\b/i.test(message);
  const mencionaIndiferente =
    /\bme da lo mismo\b|\bno importa\b|\bcualquiera\b|\bMe da lo mismo\b|\bNo importa\b|\bCualquiera\b/i.test(
      message
    );

  // Ubicación (permitimos texto libre, pero tenemos algunas típicas)
  const ubicacionesTipicas = [
    "santiago",
    "rm",
    "region metropolitana",
    "valparaíso",
    "valparaiso",
    "arica",
    "tarapacá",
    "tarapaca",
    "calama",
    "iquique",
    "coquimbo",
    "viña",
    "viña del mar",
    "los andes",
    "rancagua",
    "temuco",
    "osorno",
    "puerto montt",
    "puerto varas",
    "punta arenas",
    "antofagasta",
    "biobío",
    "biobio",
    "concepción",
    "conce",
    "chile",
  ];
  const ubicacionDetectada = ubicacionesTipicas.find((u) =>
    new RegExp("\\b" + u + "\\b", "i").test(message)
  );

  // ─────────────────────────────────────────────
  // APLICAR RESPUESTA AL FLUJO PENDIENTE
  // (solo usamos pasoOriginal, así no saltamos 2 pasos)
  // ─────────────────────────────────────────────

  // 1) Esperando ÁREA
  if (pasoOriginal === "area") {
    if (usaCvComoArea) {
      areaDefinida = "desde_cv";
    } else if (message.trim().length > 1) {
      // ÁREA LIBRE: cualquier texto sirve ("optimización", "minería", etc.)
      areaDefinida = message.trim();
    }
    // después de área SIEMPRE viene modalidad
    pasoPendiente = "modalidad";
  }

  // 2) Esperando MODALIDAD
  if (pasoOriginal === "modalidad") {
    if (mencionaIndiferente) {
      modalidadDefinida = "cualquiera";
      pasoPendiente = null; // no se requiere ubicación
    } else if (mencionaRemoto) {
      modalidadDefinida = "remoto";
      pasoPendiente = null; // remoto → ubicación opcional (no forzada)
    } else if (mencionaHibrido) {
      modalidadDefinida = "hibrido";
      pasoPendiente = "ubicacion"; // híbrido → preguntar ubicación
    } else if (mencionaPresencial) {
      modalidadDefinida = "presencial";
      pasoPendiente = "ubicacion"; // presencial → preguntar ubicación
    } else {
      // Si no entendimos la modalidad, seguimos pidiendo modalidad
      pasoPendiente = "modalidad";
    }
  }

  // 3) Esperando UBICACIÓN
  if (pasoOriginal === "ubicacion") {
    if (mencionaIndiferente) {
      ubicacionDefinida = "cualquiera";
      pasoPendiente = null;
    } else if (ubicacionDetectada || message.trim().length > 1) {
      // Aceptamos cualquier ciudad/región que escriba
      ubicacionDefinida = message.trim();
      pasoPendiente = null;
    } else {
      // No entendimos ubicación, seguimos pidiéndola
      pasoPendiente = "ubicacion";
    }
  }

  // Si aún no se inició el flujo pero ya habla de trabajo, fuerza preguntar área
  if (hablaTrabajo && !areaDefinida && pasoPendiente === null) {
    pasoPendiente = "area";
  }

  // ─────────────────────────────────────────────
  // CÁLCULO DE FLAGS
  // ─────────────────────────────────────────────

  const requiereUbicacion =
    modalidadDefinida === "hibrido" || modalidadDefinida === "presencial";

  const debePreguntarArea = pasoPendiente === "area";
  const debePreguntarModalidad = pasoPendiente === "modalidad";
  const debePreguntarUbicacion = pasoPendiente === "ubicacion";

  const listoParaRecomendar =
    hablaTrabajo &&
    !!areaDefinida &&
    !!modalidadDefinida &&
    (!requiereUbicacion || !!ubicacionDefinida) &&
    pasoPendiente === null;

  console.log("DEBUG ESTADO:", {
    hablaTrabajo,
    areaDefinida,
    modalidadDefinida,
    ubicacionDefinida,
    pasoPendiente,
    debePreguntarArea,
    debePreguntarModalidad,
    debePreguntarUbicacion,
    listoParaRecomendar,
  });

  // ─────────────────────────────────────────────
  // SYSTEM PROMPT PARA LA IA
  // ─────────────────────────────────────────────

    const systemPrompt = `
Eres un orientador laboral experto. Trabajas con el CV del usuario, sus preferencias y el siguiente CSV de ofertas para ayudarle a encontrar los mejores empleos posibles.

ESTADO (NO SE LO DIGAS AL USUARIO):
- hablaTrabajo = ${hablaTrabajo ? "sí" : "no"}
- areaDefinida = ${areaDefinida ?? "(aún no definida)"}
- modalidadDefinida = ${modalidadDefinida ?? "(aún no definida)"}
- ubicacionDefinida = ${ubicacionDefinida ?? "(aún no definida)"}
- pasoPendiente = ${pasoPendiente ?? "ninguno"}
- listoParaRecomendar = ${listoParaRecomendar ? "sí" : "no"}

/* ─────────────────────────────────────────────
   REGLA GLOBAL MUY IMPORTANTE
   ───────────────────────────────────────────── */
- SOLO puedes hacer **UNA** de estas cosas en cada turno:
  1) Preguntar por área,
  2) Preguntar por modalidad,
  3) Preguntar por ubicación,
  4) O recomendar empleos.
- NUNCA combines dos de estas acciones en la misma respuesta.
- Si "listoParaRecomendar" = "sí", **NO puedes hacer más preguntas de aclaración**. Debes pasar DIRECTAMENTE a recomendar empleos.

1) FLUJO DE PREGUNTAS (ESTRUCTURA OBLIGATORIA)
------------------------------------------------
A) Si "pasoPendiente" = "area":
   ➤ Tu respuesta DEBE ser SOLO esta pregunta (y nada más):
   "¿Tienes alguna área de interés específica (por ejemplo: datos, desarrollo web, soporte, ciberseguridad, UX, marketing, etc.) o prefieres que use lo que aparece en tu CV?"
   ➤ No recomiendes empleos, no pidas modalidad ni ubicación.

B) Si "pasoPendiente" = "modalidad":
   ➤ Tu respuesta DEBE ser SOLO esta pregunta:
   "¿Qué modalidad prefieres: remoto, híbrido, presencial o me da lo mismo?"
   ➤ No recomiendes empleos, no pidas ubicación.

C) Si "pasoPendiente" = "ubicacion":
   ➤ Tu respuesta DEBE ser SOLO esta pregunta:
   "¿En qué ciudad o región te gustaría trabajar? Si te da lo mismo la ubicación, también puedes decir 'me da lo mismo'."
   ➤ No recomiendes empleos.

D) Solo si "listoParaRecomendar" = "sí":
   ➤ Puedes usar el CSV de ofertas y recomendar empleos, siguiendo las reglas de abajo.
   ➤ IMPORTANTE:
      - Si modalidadDefinida = "remoto": NUNCA vuelvas a preguntar por ubicación. La ubicación NO es relevante.
      - Si modalidadDefinida ≠ "remoto": ya no puedes hacer más preguntas; solo recomendar empleos.

2) ANÁLISIS DEL CV (SI EXISTE)
------------------------------------------------
- Si hay CV, léelo y coméntalo cuando vayas a recomendar empleos:
  - Experiencia principal.
  - Fortalezas detectadas.
  - Áreas mejorables.
  - Nivel técnico aproximado.
  - Un pequeño resumen de quién es el/la candidato/a.

- Si NO hay CV, igual puedes orientar, pero sugiérele subir uno para mejorar la recomendación.

CV DEL USUARIO (recortado si es muy largo):
${tieneCV ? cvGuardado : "(no hay CV cargado todavía)"}

3) CUANDO "listoParaRecomendar" = "sí": USO DEL CSV + FILTROS Y PLAN B
------------------------------------------------
Solo cuando "listoParaRecomendar" = "sí" y el usuario está claramente pidiendo recomendaciones laborales, usa el CSV:

${
  hablaTrabajo
    ? ofertasTexto
    : "(el usuario no pidió trabajo, NO USES el CSV ni recomiendes empleos concretos)."
}

/* ── PASO 1: FILTROS DUROS PRINCIPALES ───────────────────────── */

/* 1) FILTRO DURO POR MODALIDAD (PREFERENCIA PRINCIPAL) */
- Toma "modalidadDefinida" como RESTRICCIÓN ESTRICTA INICIAL:
  - Si modalidadDefinida = "remoto": considera primero SOLO ofertas "Remoto".
  - Si modalidadDefinida = "presencial": considera primero SOLO ofertas "Presencial".
  - Si modalidadDefinida = "hibrido": considera primero SOLO ofertas "Híbrido".
  - Si modalidadDefinida = "cualquiera": no filtres por modalidad en este paso.

/* 2) FILTRO DURO POR UBICACIÓN (SI APLICA) */
- Si modalidadDefinida es "presencial" o "hibrido"
  Y "ubicacionDefinida" NO es "cualquiera" ni nula:
   ➤ Filtra primero SOLO ofertas cuya columna "ubicacion" coincida con "ubicacionDefinida"
      (por ejemplo, si el usuario puso "Santiago", SOLO ofertas con ubicacion = "Santiago").

- Si modalidadDefinida es "remoto" o ubicacionDefinida = "cualquiera":
   ➤ NO filtres por ubicación en este primer paso.

Llama al conjunto que sobrevive a estos filtros iniciales **CANDIDATOS_EXACTOS**.

/* ── PASO 2: ¿QUÉ PASA SI NO HAY NINGÚN CANDIDATO_EXACTO? ───────────────────────── */

- Si CANDIDATOS_EXACTOS contiene al menos 1 oferta:
   ➤ Usa SOLO esas ofertas para calcular el % de match y armar el Top 3.

- Si CANDIDATOS_EXACTOS está vacío (0 ofertas):
   ➤ Debes hacer DOS cosas, en este orden:

   1) Informar al usuario con una frase clara, por ejemplo:
      "No encontré ofertas que cumplan exactamente con tu preferencia de modalidad y ubicación."

   2) Construir un conjunto de **CANDIDATOS_FLEXIBLES** relajando las condiciones así:

      a) RELAJAR UBICACIÓN:
         - Si el usuario dio una ciudad específica (por ejemplo "Santiago"):
           · Puedes considerar ciudades cercanas (por ejemplo: "Santiago", "Valparaíso", "Viña del Mar", "Rancagua", "Los Andes")
           · Pero debes dejar claro en el texto que son ubicaciones cercanas, no la exacta.
         - Si ubicacionDefinida = "cualquiera": no hay nada que relajar aquí.

      b) RELAJAR MODALIDAD según esta regla:

         - Si modalidadDefinida = "presencial":
             · Mantén primero "Presencial".
             · Si casi no hay opciones, agrega también ofertas "Híbrido" como alternativas.
         - Si modalidadDefinida = "hibrido":
             · Puedes incluir ofertas "Híbrido", "Presencial" y "Remoto" como alternativas.
         - Si modalidadDefinida = "remoto":
             · Mantén modalidad "Remoto" (la flexibilidad se da más bien en ubicación).

      c) Con esas reglas, arma CANDIDATOS_FLEXIBLES y escoge las 3 mejores ofertas.
         - PRESENTA estas ofertas como **alternativas** y dilo explícitamente, por ejemplo:
           "Como alternativas cercanas a lo que buscas, te sugiero estas opciones..."

      d) Está PROHIBIDO:
         - Presentar CANDIDATOS_FLEXIBLES como si cumplieran exactamente lo pedido.
         - Decir "encontré estas ofertas presenciales en Santiago" si en realidad son híbridas o en otras ciudades.

/* ── PASO 3: CÁLCULO DEL % DE MATCH ───────────────────────── */
- Trabaja siempre SOLO con el conjunto seleccionado (CANDIDATOS_EXACTOS si no está vacío, en caso contrario CANDIDATOS_FLEXIBLES).
- Estimación mental del match:
  - Hasta 50%: similitud de habilidades/tecnologías entre el CV y "habilidades".
  - Hasta 30%: encaje entre experiencia requerida y experiencia del candidato.
  - Hasta 20%: alineación con el área de interés (texto de "areaDefinida").
- No expliques la fórmula; solo usa un porcentaje razonable entre 0% y 100%.

/* ── PASO 4: PRESENTACIÓN ───────────────────────── */
- Presenta SIEMPRE un bloque claro:

**🎯 Top 3 empleos recomendados para ti:**

1. **[Título del puesto] – [Empresa]**  
   - Match estimado: 87%  
   - Ubicación/modalidad: [ubicación], [modalidad]  
   - Motivo del encaje: (2–3 líneas explicando por qué calza con su experiencia, habilidades y preferencias).

- Si estás usando CANDIDATOS_FLEXIBLES (porque no había coincidencias exactas):
   ➤ Dilo en el texto, por ejemplo:
      "Como no encontré opciones exactas con tu modalidad y ubicación, estas son alternativas cercanas que podrían interesarte."

4) ESTILO DE RESPUESTA
------------------------------------------------
- Lenguaje natural, cercano y motivador.
- Usa Markdown simple: **negritas**, listas, párrafos cortos.
- Evita repetir textualmente lo mismo muchas veces.
- No inventes datos del CSV.
- Respeta SIEMPRE los filtros y el plan de flexibilidad explicados arriba.
- Cuando "listoParaRecomendar" = "sí", NO hagas más preguntas: solo analiza el CV y recomienda empleos.
`;


  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
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
    });

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

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Servidor IA corriendo en el puerto ${PORT}`);
});




