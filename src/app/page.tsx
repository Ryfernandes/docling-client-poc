"use client";

import "./page.css";

import { useState, useRef } from "react";

import ChatbotPanel, { Message } from "@/components/ChatbotPanel"
import DoclingPreview from "@/components/DoclingPreview";
import DocumentInfoBar from "@/components/DocumentInfoBar";
import SelectionInfo from "@/components/SelectionInfo";
import testBofa from '@/data/test-bofa.json';

export default function Home() {
  const [documentData, setDocumentData] = useState<any>(null);
  const [documentInfo, setDocumentInfo] = useState<{
    name: string;
    size: number;
    lastModified?: Date;
  } | null>(null);
  const [selectedCrefs, setSelectedCrefs] = useState<string[]>([]);

  const handlePromptSubmit = (prompt: string) => {
    alert(`Prompt submitted: ${prompt}`);
  }

  const handleDocumentLoad = (document: any) => {
    setDocumentData(document.data);
    setDocumentInfo({
      name: document.name,
      size: document.size,
      lastModified: document.lastModified
    });
  }
  
  const handleDocumentRemove = () => {
    setDocumentData(null);
    setDocumentInfo(null);
  }

  const displayData = documentData || testBofa;

  return (
    <div className="page-container">
      <div className="left">
        <div className="panel top-left">
          <SelectionInfo selectedCrefs={selectedCrefs} />
        </div>
        <div className="panel bottom-left">
          <ChatbotPanel onPromptSubmit={handlePromptSubmit} messages={[]} />
        </div>
      </div>
      <div className="panel right">
        <DocumentInfoBar
          currentDocument={documentInfo}
          onDocumentLoad={handleDocumentLoad}
          onDocumentRemove={handleDocumentRemove}
        />
        <DoclingPreview data={displayData} setSelectedCrefs={setSelectedCrefs}/>
      </div>
    </div>
  );
}