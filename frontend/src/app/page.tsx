"use client";

import "./page.css";

import { useState, useEffect, useRef } from "react";
import { type Delta, create } from 'jsondiffpatch';

import ChatbotPanel, { Message } from "@/components/ChatbotPanel"
import DoclingPreview from "@/components/DoclingPreview";
import DocumentInfoBar from "@/components/DocumentInfoBar";
import SelectionInfo from "@/components/SelectionInfo";
import CostInfo from "@/components/CostInfo";

const jsondiffpatch = create()

export default function Home() {
  const MAX_STACK_SIZE = 20; // Maximum number of document diffs to keep in the history stack

  const [startDocument, setStartDocument] = useState<object | null>(null);
  const [endDocument, setEndDocument] = useState<object | null>(null);
  const [documentStack, setDocumentStack] = useState<Delta[]>([]);
  const [documentInfo, setDocumentInfo] = useState<{
    name: string;
    size: number;
    lastModified?: Date;
  } | null>(null);
  const [selectedCrefs, setSelectedCrefs] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [costs, setCosts] = useState<{ kind: string; cost: number; total: number }[]>([]);
  const [canceling, setCanceling] = useState(false);
  const [compressingContext, setCompressingContext] = useState(false);

  const scrollBoxRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    console.log("Document stack updated:", documentStack);
  }, [documentStack]);

  const addToDocumentStack = (newDocument: any) => {
    const startClone = JSON.parse(JSON.stringify(startDocument));
    const endClone = JSON.parse(JSON.stringify(endDocument));

    const delta = jsondiffpatch.diff(endClone, newDocument);
    if (delta) {
      setDocumentStack(prevStack => [...prevStack, delta]);
    }
    setEndDocument(newDocument);

    if (documentStack.length > MAX_STACK_SIZE) {
      const newStart = jsondiffpatch.patch(startClone, documentStack[0]) as object;
      setStartDocument(newStart);

      setDocumentStack(prevStack => prevStack.slice(1));
    }
  }

  const handleUndo = () => {
    if (documentStack.length === 0) return;

    const endClone = JSON.parse(JSON.stringify(endDocument));

    const lastDelta = documentStack[documentStack.length - 1];
    const newDocument = jsondiffpatch.unpatch(endClone, lastDelta) as object;

    setEndDocument(newDocument);
    setDocumentStack(prevStack => prevStack.slice(0, -1));
  }

  const clearContext = async () => {
    try {
      await fetch("http://127.0.0.1:8001/clear_context/", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: prompt, document: endDocument, selectedCrefs: selectedCrefs })
      });

      setMessages([]);
      setSelectedCrefs([]);
    } catch (error) {
      console.error('Error clearing context', error);
    }
  }

  const handlePromptSubmit = async (prompt: string) => {
    if (endDocument) {
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
          body: JSON.stringify({ query: prompt, document: endDocument, selectedCrefs: selectedCrefs })
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

            console.log(line);

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
                if (json.content.text.substring(0, 5) === "Error") {
                  continue;
                }

                const json_text = JSON.parse(json.content.text);

                if ('document' in json_text) {
                  const doc = json_text.document;

                  addToDocumentStack(doc);
                }
              }
            }
            if (json.type === 'tool_error') {
              setMessages(prevMessages => [...prevMessages, 
                {
                  id: id,
                  text: `❌ Tool error: ${json.content}`,
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
            if (json.type === 'cost') {
              setCosts(prevCosts => [...prevCosts, 
                {
                  kind: json.kind || 'General',
                  cost: json.cost,
                  total: json.total
                }
              ]);
            }
            if (json.type === 'compressing_context') {
              setCompressingContext(true);
            }
            if (json.type === 'cancelled') {
              setMessages(prevMessages => [...prevMessages, 
                {
                  id: id,
                  text: "Execution cancelled.",
                  sender: 'bot',
                  timestamp: new Date()
                }
              ]);
            }
          }
        }

        setLoading(false);
        setCompressingContext(false);
      } catch (error) {
        console.error('Error calling Python API', error);
        setLoading(false);
        setCompressingContext(false);
      }
    }
  }

  const handleDocumentLoad = (document: any) => {
    setStartDocument(document.data);
    setEndDocument(document.data);
    setDocumentInfo({
      name: document.name,
      size: document.size,
      lastModified: document.lastModified
    });
    clearContext();

    scrollBoxRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  const handleDocumentRemove = () => {
    setStartDocument(null);
    setEndDocument(null);
    clearContext();
  }

  const handleCancellation = async () => {
    try {
      if (canceling) return;

      setCanceling(true);

      const response = await fetch("http://127.0.0.1:8001/stop_processing/", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error cancelling processing:', errorData);
        return;
      }
      
      setLoading(false);
      setCanceling(false);
    } catch (error) {
      console.error('Error cancelling processing:', error);
    }
  };

  return (
    <div className="page-container">
      <div className="left">
        <div className="panel top-left">
          <div className="panel cost">
            <CostInfo costs={costs}/>
          </div>
          <div className="panel selection">
            <SelectionInfo selectedCrefs={selectedCrefs} />
          </div>
        </div>
        <div className="panel bottom-left">
          <ChatbotPanel 
            active={endDocument != null} 
            loading={loading}
            compressingContext={compressingContext}
            onPromptSubmit={handlePromptSubmit} 
            messages={messages} 
            clearContext={clearContext}
            onCancel={handleCancellation} 
            canceling={canceling}
            onUndo={handleUndo}
            canUndo={documentStack.length > 0}
          />
        </div>
      </div>
      <div className="panel right">
        <DocumentInfoBar
          currentDocument={documentInfo}
          documentData={endDocument}
          onDocumentLoad={handleDocumentLoad}
          onDocumentRemove={handleDocumentRemove}
        />
        <DoclingPreview data={endDocument} setSelectedCrefs={setSelectedCrefs} scrollBoxRef={scrollBoxRef}/>
      </div>
    </div>
  );
}