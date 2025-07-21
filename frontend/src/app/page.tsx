"use client";

import "./page.css";

import { useState, useEffect, useRef } from "react";

import ChatbotPanel, { Message } from "@/components/ChatbotPanel"
import DoclingPreview from "@/components/DoclingPreview";
import DocumentInfoBar from "@/components/DocumentInfoBar";
import SelectionInfo from "@/components/SelectionInfo";

export default function Home() {
  const [documentData, setDocumentData] = useState<object | null>(null);
  const [documentInfo, setDocumentInfo] = useState<{
    name: string;
    size: number;
    lastModified?: Date;
  } | null>(null);
  const [selectedCrefs, setSelectedCrefs] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const numMessages = useRef(0);

  useEffect(() => {
    async function setup() {
      await fetch("http://127.0.0.1:8001/setup", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        },
      });
    }

    setup();
  }, []);

  const clearContext = async () => {
    try {
      await fetch("http://127.0.0.1:8001/clear_context/", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: prompt, document: documentData, selectedCrefs: selectedCrefs })
      });

      setMessages([]);
      setSelectedCrefs([]);
    } catch (error) {
      console.error('Error clearing context', error);
    }
  }

  const handlePromptSubmit = async (prompt: string) => {
    if (documentData) {
       try {
        setMessages(prevMessages => [...prevMessages, 
          {
            id: Date.now().toString(),
            text: prompt,
            sender: 'user',
            timestamp: new Date()
          }
        ]);

        setLoading(true);

        const response = await fetch("http://127.0.0.1:8001/message/", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: prompt, document: documentData, selectedCrefs: selectedCrefs })
        });

        if (!response.body) {
          console.error("ReadableStream not supported");
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true })

          const parts = buffer.split("\n");
          buffer = parts.pop() || "";

          console.log(parts);

          for (const part of parts) {
            numMessages.current += 1;
            const id = numMessages.current.toString();

            const line = part.trim();
            if (!line) continue;

            let json;

            try {
              json = JSON.parse(line);
            } catch (error) {
              console.error("Error parsing JSON:", line, error);
              continue;
            }

            if (json.type === 'message') {
              setMessages(prevMessages => [...prevMessages, 
                {
                  id: id,
                  text: json.content,
                  sender: 'bot',
                  timestamp: new Date()
                }
              ]);
            }
            if (json.type === 'tool_call') {
              setMessages(prevMessages => [...prevMessages, 
                {
                  id: id,
                  text: `🛠️ Using tool "${json.name}"`,
                  sender: 'bot',
                  timestamp: new Date()
                }
              ]);
            }
            if (json.type === 'tool_result') {
              if ('text' in json.content) {
                const json_text = JSON.parse(json.content.text);

                if ('document' in json_text) {
                  const doc = json_text.document;

                  setDocumentData(doc);
                }
              }

              /*
              setMessages(prevMessages => [...prevMessages, 
                {
                  id: id,
                  text: "✅ Tool call successful",
                  sender: 'bot',
                  timestamp: new Date()
                }
              ]);
              */
            }
            if (json.type === 'tool_error') {
              setMessages(prevMessages => [...prevMessages, 
                {
                  id: id,
                  text: json.content,
                  sender: 'bot',
                  timestamp: new Date()
                }
              ]);
            }
            if (json.type === 'max_iterations') {
              setMessages(prevMessages => [...prevMessages, 
                {
                  id: id,
                  text: "Reached maximum iterations, stopping execution.",
                  sender: 'bot',
                  timestamp: new Date()
                }
              ]);
            }
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Error calling Python API', error);
        setLoading(false);
      }
    }
  }

  const handleDocumentLoad = (document: any) => {
    setDocumentData(document.data);
    setDocumentInfo({
      name: document.name,
      size: document.size,
      lastModified: document.lastModified
    });
    clearContext();
  }
  
  const handleDocumentRemove = () => {
    setDocumentData(null);
    setDocumentInfo(null);
    clearContext();
  }

  return (
    <div className="page-container">
      <div className="left">
        <div className="panel top-left">
          <SelectionInfo selectedCrefs={selectedCrefs} />
        </div>
        <div className="panel bottom-left">
          <ChatbotPanel active={documentData != null} loading={loading} onPromptSubmit={handlePromptSubmit} messages={messages} clearContext={clearContext} />
        </div>
      </div>
      <div className="panel right">
        <DocumentInfoBar
          currentDocument={documentInfo}
          documentData={documentData}
          onDocumentLoad={handleDocumentLoad}
          onDocumentRemove={handleDocumentRemove}
        />
        <DoclingPreview data={documentData} setSelectedCrefs={setSelectedCrefs}/>
      </div>
    </div>
  );
}