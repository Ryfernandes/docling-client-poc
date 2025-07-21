'use client';

import React from 'react';
import { useState, useEffect } from 'react';

import '@/components/styles/CostInfo.css';

interface CostInfoProps {
  costs: { kind: string; cost: number; total: number }[];
}

const SelectionInfo: React.FC<CostInfoProps> = ({ costs }) => {
  return (
    <div>
      <div className="cost-info-bar">
        <div className="document-info">
          <span className="document-details">
            💰 Cost {costs.length > 0 ? `($${costs[costs.length - 1]['total']})` : '($0.00)'}
          </span>
        </div>
      </div>
      
      <div className="cost-list">
        {costs.length > 0 ? (
          <>
            {costs.slice().reverse().map((cost, index) => (
              <div key={index} className="cost-item">
                <span className="index">{costs.length - 1 - index}</span>
                <span className="cost-amount">${cost.cost.toFixed(4)}</span>
                <span>{cost.kind}</span>
              </div>
            ))}
          </>
        ) : (
          <div className="no-cost">
            No queries have been sent
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectionInfo;