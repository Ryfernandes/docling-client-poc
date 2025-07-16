import "./page.css";

import Input from "@/components/chatbot/Input"
import DoclingPreview from "@/components/DoclingPreview";

export default function Home() {
  const handlePromptSubmit = (prompt: string) => {
    alert(`Prompt submitted: ${prompt}`);
  }

  return (
    <div className="page-container">
      <div className="panel left">
        <div className="header">
          <h1>
            Review Document Conversion
          </h1>
          <p>
            See the preview of your converted document below. Select elements to be edited and direct the Docling Client to make changes
          </p>
        </div>
        <div className="input">
          <Input onSubmit={handlePromptSubmit} />
        </div>
      </div>
      <div className="panel right">
        <DoclingPreview />
      </div>
    </div>
  );
}
