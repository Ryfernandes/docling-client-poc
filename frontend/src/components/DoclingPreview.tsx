'use client';

import React, { useState, useEffect, useRef } from 'react';

import { iterateDocumentItems, isDocling, type DoclingDocument } from '@docling/docling-core';

import '@/components/styles/DoclingPreview.css';

interface DoclingPreviewProps {
  data: any;
  setSelectedCrefs: React.Dispatch<React.SetStateAction<string[]>>;
}

const DoclingPreview:React.FC<DoclingPreviewProps> = ({ data, setSelectedCrefs }) => {
  const [document, setDocument] = useState<DoclingDocument>({} as DoclingDocument);
  const [items, setItems] = useState<any[]>([]);
  const [crefs, setCrefs] = useState<string[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const scrollBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedCrefs(crefs.filter((_, index) => selected[index]));
  }, [crefs, selected])

  useEffect(() => {
    const fetchDocument = async () => {
      setDocument(data as unknown as DoclingDocument);
    }

    fetchDocument().catch(console.error);
  }, [data]);

  useEffect(() => {
    if (document && Object.keys(document).length > 0) {
      const docItems = iterateDocumentItems(document);
      setItems([...docItems]);
    }

    scrollBoxRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [document]);

  useEffect(() => {
    setCrefs(items.map(([item, _]) => item.self_ref));
    setSelected(Array(items.length).fill(false));
  }, [items]);

  const itemRepresentation = (item: any, level: any, index: number) => {
    if (item.content_layer !== "furniture") {
      switch (item.label) {
        case "text":
          return <div className={`docling-item text`}>{item.text}</div>;
        case "paragraph":
          return <div className={`docling-item paragraph`}>{item.text}</div>;
        case "title":
          return <div className={`docling-item title`}>{item.text}</div>;
        case "section_header":
          return <div className={`docling-item section-header level-${item.level}`}>{item.text}</div>;
        case "list_item":
          return <div className={`docling-item list-item`} style={{ 'paddingLeft' : `calc(20px * ${level - 1})` }}>{item.text}</div>;
        case "picture":
          return <div className={`docling-item picture`}>🖼️ Picture Here 🖼️</div>;
        case "table":
          return (
            <div className="docling-item table-container">
              <table className="docling-table">
                <tbody>
                  {(() => {
                    const coveredCells: boolean[][] = Array(item.data.num_rows)
                      .fill(null)
                      .map(() => Array(item.data.num_cols).fill(false));
                      
                    return item.data.grid.map((row: any, rowIndex: number) => (
                      <tr key={rowIndex} className="docling-table-row">
                        {row.map((cell: any, cellIndex: number) => {
                          if (coveredCells[rowIndex][cellIndex]) {
                            return null;
                          }
                          
                          const rowSpan = cell.row_span || 1;
                          const colSpan = cell.col_span || 1;
                          
                          for (let r = 0; r < rowSpan; r++) {
                            for (let c = 0; c < colSpan; c++) {
                              if (rowIndex + r < item.data.num_rows && 
                                  cellIndex + c < item.data.num_cols) {
                                coveredCells[rowIndex + r][cellIndex + c] = true;
                              }
                            }
                          }
                          
                          const CellTag = cell.column_header || cell.row_header ? 'th' : 'td';
                          
                          return (
                            <CellTag 
                              key={cellIndex}
                              className={`docling-table-cell ${cell.column_header ? 'column-header' : ''} ${cell.row_header ? 'row-header' : ''}`}
                              rowSpan={rowSpan}
                              colSpan={colSpan}
                            >
                              {cell.text || ''}
                            </CellTag>
                          );
                        })}
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          );
        default:
          return <div className={`docling-item unknown`}>{level} Unknown label: {item.label} {JSON.stringify(item)}</div>;
      }
    }

    return null;
  }

  const handleSelect = (index: number, event: React.MouseEvent) => {
    if (event.shiftKey && lastSelectedIndex !== null) {
      setSelected(prev => {
        const newSelected = [...prev];
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        
        for (let i = start; i <= end; i++) {
          newSelected[i] = !selected[index];
        }
        
        return newSelected;
      });
    } else {
      setSelected(prev => {
        const newSelected = [...prev];
        newSelected[index] = !newSelected[index];
        return newSelected;
      });
    }

    setLastSelectedIndex(index);
  }

  return (
    <div ref={scrollBoxRef} className="docling-preview">
      <div className="document-content">
        {data == null ? (
          <div className="no-document-message">
            <p>No document loaded</p>
            <p>Please use the upload button in the toolbar to get started.</p>
          </div>
        ) : (
          <>
            {
              items.map(([item, level], index) => {
                const representation = itemRepresentation(item, level, index);

                if (!representation) return null;

                return (
                  <div 
                    key={item.self_ref || index} 
                    className={`document-item-container ${selected[index] ? 'selected' : ''}`} 
                    onClick={(e) => handleSelect(index, e)}
                  >
                    {representation}
                  </div>
                );
              })
            }
          </>
        )}
      </div>
    </div>
  );
}

export default DoclingPreview;