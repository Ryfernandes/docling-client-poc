interface ChatbotInputProps {
  onSubmit: (prompt: string) => void;
}

const ChatbotInput = ({ onSubmit }: ChatbotInputProps) => {
  return (
    <div className="chatbot-input">
      <p>
        Custom prompt input will go here
      </p>
    </div>
  );
}

export default ChatbotInput;