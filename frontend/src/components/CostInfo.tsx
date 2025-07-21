'use client';

import React from 'react';
import { useState, useEffect } from 'react';

import '@/components/styles/CostInfo.css';

interface CostInfoProps {
}

const SelectionInfo: React.FC<CostInfoProps> = ({}) => {
  return (
    <div>
      <div className="cost-info-bar">
        <div className="document-info">
          <span className="document-details">
            💰 Cost
          </span>
        </div>
      </div>
      
      <div className="cost-list">
        Content here
      </div>
    </div>
  );
};

export default SelectionInfo;