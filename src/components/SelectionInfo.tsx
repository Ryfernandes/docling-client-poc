'use client';

import React from 'react';
import { useState, useEffect } from 'react';

import '@/components/styles/SelectionInfo.css';

interface SelectionInfoProps {
  selectedCrefs: string[];
}

const SelectionInfo: React.FC<SelectionInfoProps> = ({
  selectedCrefs
}) => {
  return (
    <div>
      <div className="selection-info-bar">
        <div className="document-info">
          <span className="document-details">
            Selected Items
          </span>
        </div>
      </div>
      
      <div className="selection-list">
        {selectedCrefs.length > 0 ? (
          <ul className="crefs-list">
            {selectedCrefs.map((cref, index) => (
              <li key={index} className="cref-item">{cref}</li>
            ))}
          </ul>
        ) : (
          <div className="no-selection">No items selected</div>
        )}
      </div>
    </div>
  );
};

export default SelectionInfo;