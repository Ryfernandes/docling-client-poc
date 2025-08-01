import React, { useRef } from 'react';
import '@/components/styles/DocumentInfoBar.css';

interface DocumentInfoBarProps {
  currentDocument: {
    name: string;
    size: number;
    lastModified?: Date;
  } | null;
  documentData?: object | null;
  onDocumentLoad: (data: any) => void;
  onDocumentRemove: () => void;
}

const DocumentInfoBar: React.FC<DocumentInfoBarProps> = ({
  currentDocument,
  documentData,
  onDocumentLoad,
  onDocumentRemove
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) return;
    
    // Validate that it's a JSON file
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      alert('Please upload a JSON file');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    // Read the file content
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        onDocumentLoad({
          data: json,
          name: file.name,
          size: file.size,
          lastModified: new Date(file.lastModified)
        });
      } catch (error) {
        alert('Invalid JSON file. Please check the file format.');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    
    reader.readAsText(file);
  };

  const handleDocumentRemove = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onDocumentRemove();
  }

  const handleDownload = () => {
    if (!currentDocument || !documentData) return;
    
    // Create a blob with the JSON data
    const blob = new Blob([JSON.stringify(documentData, null, 2)], { type: 'application/json' });
    
    // Create a download URL
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link to trigger the download
    const link = document.createElement('a');
    link.href = url;
    link.download = currentDocument.name;
    
    // Append to body, click, and then remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="document-info-bar">
      <div className="document-info">
        {currentDocument ? (
          <span className="document-details">
            {currentDocument.name} <span className="size-info">({formatFileSize(currentDocument.size)})</span>
          </span>
        ) : (
          <span className="no-document">No document loaded</span>
        )}
      </div>
      
      <div className="document-actions">
        <label className="icon-button enabled upload-icon" title={currentDocument ? 'Change Document' : 'Upload Document'}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </label>
        
        {currentDocument && (
          <>
            <button className="icon-button enabled download-icon" onClick={handleDownload} title="Download Document">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            
            <button className="icon-button enabled remove-icon" onClick={handleDocumentRemove} title="Remove Document">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentInfoBar;