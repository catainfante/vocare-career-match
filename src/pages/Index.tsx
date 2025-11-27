// src/pages/index.tsx (o donde esté este componente)
import { useState, useRef } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { MessageBubble } from "@/components/MessageBubble";
import { ChatInput } from "@/components/ChatInput";
import { DatabasePanel } from "@/components/DatabasePanel";
import Headbar from "@/components/Headbar";
import Navbar from "@/components/Navbar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  lastUpdated: string;
  messages: Message[];
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

const WELCOME_MESSAGES = [
  "👋 ¡Hola! Soy Vocare, tu asistente laboral.\n\nPuedo analizar tu CV o tus intereses y recomendarte las mejores oportunidades laborales.\n\n¿Quieres subir tu currículum o contarme sobre ti?",
  "¡Hola! 🌟 Me llamo Vocare y estoy aquí para ayudarte a encontrar oportunidades laborales que se ajusten a tu perfil.\n\n¿Tienes tu CV a mano o prefieres contarme sobre tu experiencia?",
  "¡Bienvenido! 💼 Soy Vocare, tu compañero en la búsqueda laboral.\n\nPuedo revisar tu currículum o simplemente conversar sobre tus intereses profesionales.\n\n¿Cómo te gustaría empezar?",
];

const getRandomMessage = (messages: string[]) =>
  messages[Math.floor(Math.random() * messages.length)];

const createWelcomeMessage = (): Message => ({
  id: "welcome-" + Date.now(),
  role: "assistant",
  content: getRandomMessage(WELCOME_MESSAGES),
});

const Index = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: "1",
      title: "Búsqueda de empleo en tecnología",
      lastUpdated: "Hace 2 horas",
      messages: [createWelcomeMessage()],
    },
  ]);
  const [activeConversationId, setActiveConversationId] = useState<string>("1");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );

  // ───────────────────────
  // Enviar mensaje al backend
  // ───────────────────────
  const handleSendMessage = async (content: string) => {
    if (!activeConversationId || !content.trim()) return;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    };

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === activeConversationId
          ? {
              ...conv,
              messages: [...conv.messages, newUserMessage],
              lastUpdated: "Ahora",
            }
          : conv
      )
    );

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      const data = await res.json();

      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply ?? "(sin respuesta)",
      };

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeConversationId
            ? {
                ...conv,
                messages: [...conv.messages, botResponse],
                lastUpdated: "Ahora",
              }
            : conv
        )
      );
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "No se pudo conectar al servidor",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ───────────────────────
  // Subir CV al backend
  // ───────────────────────
  const handleFileUpload = (file: File) => {
    toast({
      title: "✓ CV recibido",
      description: `${file.name} se está analizando...`,
    });

    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64CV = reader.result as string;

      try {
        const res = await fetch(`${API_BASE_URL}/api/cv`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cv: base64CV }),
        });

        const data = await res.json();

        const botMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: data.message ?? "CV recibido correctamente.",
        };

        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === activeConversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, botMessage],
                  lastUpdated: "Ahora",
                }
              : conv
          )
        );
      } catch (err) {
        console.error(err);
        toast({
          title: "Error",
          description: "No se pudo subir el CV",
        });
      } finally {
        setIsLoading(false);
      }
    };

    // Si tu CV viene en PDF, aquí lo estás mandando como Base64.
    // Tu backend actualmente solo lo guarda como texto y se lo pasa al modelo.
    // Más adelante podrías cambiar esto por un parseo real con pdf-parse.
    reader.readAsDataURL(file);
  };

  // ───────────────────────
  // Nueva conversación (frontend + backend)
  // ───────────────────────
  const handleNewConversation = async () => {
    // 1) Resetear SIEMPRE el estado del backend (incluye borrar CV y preferencias)
    try {
      await fetch(`${API_BASE_URL}/api/reset-conversacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // keepCv: false por defecto, pero lo dejamos explícito:
        body: JSON.stringify({ keepCv: false }),
      });
    } catch (err) {
      console.error("Error al resetear conversación en backend:", err);
      toast({
        title: "Error",
        description: "No se pudo reiniciar la conversación en el servidor",
      });
    }

    // 2) Crear una nueva conversación limpia en el front
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: "Nueva conversación",
      lastUpdated: "Ahora",
      messages: [createWelcomeMessage()],
    };

    setConversations((prev) => [...prev, newConv]);
    setActiveConversationId(newConv.id);
  };

  const handleDeleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));

    if (activeConversationId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      setActiveConversationId(remaining[0]?.id || "");
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
      <Headbar />
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <ChatSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={setActiveConversationId}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
        />

        <main className="flex-1 flex flex-col relative">
          <ScrollArea className="flex-1 px-4 md:px-8">
            <div className="max-w-4xl mx-auto py-8">
              {activeConversation?.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  role={message.role}
                  content={message.content}
                />
              ))}
            </div>
          </ScrollArea>

          <ChatInput
            onSendMessage={handleSendMessage}
            onFileUpload={handleFileUpload}
            isLoading={isLoading}
          />
        </main>

        <DatabasePanel
          isOpen={isPanelOpen}
          onToggle={() => setIsPanelOpen(!isPanelOpen)}
        />
      </div>

      {/* Hidden file input (por si lo usas en otro lado) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileInputChange}
      />
    </div>
  );
};

export default Index;
